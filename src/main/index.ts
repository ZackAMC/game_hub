// PROCESO MAIN: arma las piezas (composition root) y atiende a la UI por IPC.
// Es el único lugar que sabe que existen Electron, Steam y el JSON a la vez.

import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, net, protocol, shell, Tray } from 'electron'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FileArtworkStore } from '../adapters/artwork/FileArtworkStore.js'
import { SteamGridDbArtwork } from '../adapters/artwork/SteamGridDbArtwork.js'
import { SteamStoreArtwork } from '../adapters/artwork/SteamStoreArtwork.js'
import { JsonLocalGameStore } from '../adapters/local/JsonLocalGameStore.js'
import { LocalSource } from '../adapters/local/LocalSource.js'
import { SafeStorageSecretStore } from '../adapters/secrets/SafeStorageSecretStore.js'
import { detectSteamId } from '../adapters/steam/loginUsers.js'
import { isValidApiKeyFormat, SteamAchievements, type HttpResult } from '../adapters/steam/SteamAchievements.js'
import { SteamPlaytime } from '../adapters/steam/SteamPlaytime.js'
import { SteamSource } from '../adapters/steam/SteamSource.js'
import { folderStats } from '../adapters/system/folderStats.js'
import { forceForeground } from '../adapters/system/foreground.js'
import { isProcessRunning } from '../adapters/system/processes.js'
import { AchievementService, type AchievementResult } from '../application/AchievementService.js'
import { ArtworkService } from '../application/ArtworkService.js'
import { GameCatalog } from '../application/GameCatalog.js'
import { SessionTracker } from '../application/SessionTracker.js'
import { StorePlaytimeService } from '../application/StorePlaytimeService.js'
import type { Game } from '../domain/Game.js'
import { summarizePlaytime, type PlaytimeSummary, type StorePlaytime } from '../domain/Playtime.js'
import type { SecretStore } from '../domain/ports/SecretStore.js'
import iconPath from '../../build/icon.png?asset'
import { autostartEnabled, autostartSupported, enableAutostartOnFirstRun, HIDDEN_FLAG, setAutostart } from './autostart.js'
import { Curtain } from './curtain.js'
import {
  IPC,
  type CurtainState,
  type AchievementsDTO,
  type ArtworkCandidateDTO,
  type GameDTO,
  type LibraryDTO,
  type PlaytimeDTO,
  type SessionDTO,
  type SteamKeyStatusDTO,
  type UninstallPreviewDTO,
  type UninstallResultDTO,
} from '../shared/contract.js'

const here = dirname(fileURLToPath(import.meta.url))

// Protocolo propio para las imágenes. Se registra ANTES de que la app esté lista.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// --- Composition root: acá se enchufan los adaptadores a los puertos ---
let catalog: GameCatalog
let local: LocalSource
let steamKey: SecretStore
let steamAchievements: SteamAchievements
let achievements: AchievementService
let artwork: ArtworkService
let sgdbKey: SecretStore
let sgdb: SteamGridDbArtwork
let sessions: SessionTracker
let curtain: Curtain
let tray: Tray | null = null
let quitting = false
let storePlaytime: StorePlaytimeService

function compose(): void {
  const userData = app.getPath('userData')

  local = new LocalSource({
    store: new JsonLocalGameStore(join(userData, 'local-games.json')),
    spawnGame,
    isProcessRunning,
    fileExists,
    newId: randomUUID,
    trash: (path) => shell.trashItem(path),
    folderStats,
    userHome: app.getPath('home'),
  })
  const steam = new SteamSource((url) => shell.openExternal(url))
  // ESCALABLE: sumar una tienda es agregar su adaptador a esta lista.
  catalog = new GameCatalog([steam, local])
  sessions = new SessionTracker({
    sources: [steam, local],
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: Date.now,
  })

  steamKey = new SafeStorageSecretStore(join(userData, 'steam-api-key.bin'))
  steamAchievements = new SteamAchievements({
    getApiKey: () => steamKey.get(),
    getSteamId: detectSteamId,
    fetchJson,
  })
  achievements = new AchievementService((id) => catalog.get(id), [steamAchievements])
  storePlaytime = new StorePlaytimeService({
    // ESCALABLE: otra tienda con horas (Epic, GOG) es otro adaptador en esta lista.
    providers: [new SteamPlaytime({ getApiKey: () => steamKey.get(), getSteamId: detectSteamId, fetchJson })],
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onError: (source, error) => console.warn(`[playtime] ${source}:`, error),
  })

  sgdbKey = new SafeStorageSecretStore(join(userData, 'steamgriddb-key.bin'))
  sgdb = new SteamGridDbArtwork({ getApiKey: () => sgdbKey.get(), fetchJson, fetchImage })

  artwork = new ArtworkService({
    findGame: (id) => catalog.get(id),
    // ESCALABLE: un proveedor más es una línea más. ArtworkService no se enteró del cambio.
    providers: [new SteamStoreArtwork({ fetchJson, fetchImage }), sgdb],
    store: new FileArtworkStore(join(userData, 'artwork')),
    setArtwork: (nativeId, patch) => local.setArtwork(nativeId, patch),
  })
}

// Las preferencias comunes de ambas ventanas: aisladas, con sandbox, y solo el preload como puente.
const secureWebPreferences: Electron.WebPreferences = {
  preload: join(here, '../preload/index.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}

function loadPage(win: BrowserWindow, page: 'index' | 'listener'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(here, `../renderer/${page}.html`))
}

function createWindows(): void {
  const main = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true, // mientras la cortina se desliza, se ve el escritorio debajo
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    skipTaskbar: true, // la app "es" el escritorio: se llega por el botón, el atajo o la bandeja
    title: 'Game Hub',
    icon: iconPath,
    webPreferences: {
      ...secureWebPreferences,
      // Los navegadores bloquean el audio hasta el primer clic. Un launcher tiene que sonar desde el inicio.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  if (app.isPackaged) main.removeMenu() // sin menú: F11 y compañía no deben pelear con la cortina

  // El oyente: invisible, de 1 px, siempre encima y atravesable por el mouse.
  const listener = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    width: 1,
    height: 1,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false, // nunca le roba el foco a lo que estés usando
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { ...secureWebPreferences, backgroundThrottling: false },
  })
  listener.setAlwaysOnTop(true, 'screen-saver') // encima de todo: si queda tapada, Chromium deja de darle el mando
  listener.setIgnoreMouseEvents(true) // los clics la atraviesan
  listener.removeMenu()

  curtain = new Curtain(main, listener, (win) => {
    try {
      forceForeground(win.getNativeWindowHandle())
    } catch (error) {
      console.warn('[hub] no se pudo traer la cortina al frente:', error) // sin foco, pero visible
    }
  })

  // Alt+F4 sobre la cortina la RECOGE: salir de la app es explícito, desde la bandeja.
  main.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    curtain.up()
  })

  loadPage(main, 'index')
  loadPage(listener, 'listener')
  listener.once('ready-to-show', () => curtain.showListener())
  // Arranque normal: la cortina baja. Con --hidden (inicio de Windows) queda recogida.
  main.once('ready-to-show', () => {
    if (!process.argv.includes(HIDDEN_FLAG)) curtain.down()
  })
}

function createTray(): void {
  tray = new Tray(iconPath)
  tray.setToolTip('Game Hub')
  refreshTrayMenu()
  tray.on('click', () => curtain.toggle())
}

// Se rearma cada vez: el tilde de "Iniciar con Windows" refleja el estado REAL (lo podés
// apagar también desde Configuración de Windows).
function refreshTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar Game Hub', click: () => curtain.down() },
      {
        label: autostartSupported() ? 'Iniciar con Windows' : 'Iniciar con Windows (solo en la app instalada)',
        type: 'checkbox',
        enabled: autostartSupported(),
        checked: autostartEnabled(),
        click: (item) => {
          setAutostart(item.checked)
          refreshTrayMenu()
        },
      },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]),
  )
}

// media://game/<id>/cover  ->  la portada de ESE juego. Solo rutas que el catálogo conoce:
// la UI no puede pedir "media://game/../../Windows/..." y leer cualquier archivo.
function serveMedia(request: Request): Promise<Response> | Response {
  const [, rawId, kind] = new URL(request.url).pathname.split('/')
  const game = rawId ? catalog.get(decodeURIComponent(rawId)) : undefined
  const path = kind === 'cover' ? game?.coverPath : kind === 'hero' ? game?.heroPath : null
  if (!path) return new Response('Not found', { status: 404 })
  return net.fetch(pathToFileURL(path).toString())
}

// --- IPC: todo lo que llega del renderer es input NO confiable ---

ipcMain.handle(IPC.list, async () => await library())

ipcMain.handle(IPC.launch, async (event, gameId: unknown) => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  await catalog.launch(gameId)
  const game = catalog.get(gameId)
  if (!game) return

  const send = (state: SessionDTO['state'], durationMs: number | null = null) => {
    if (!event.sender.isDestroyed()) event.sender.send(IPC.sessionChanged, { gameId, state, durationMs })
  }
  send('starting')
  trackedGameId = gameId

  // No esperamos: el seguimiento dura lo que dure la partida. El IPC responde ya.
  void sessions.track(game, {
    onStarted: () => {
      send('running')
      // La cortina sube y el juego queda solo en pantalla.
      curtain.setListenerActive(false)
      curtain.up()
    },
    onEnded: async (_g, durationMs) => {
      trackedGameId = null
      if (game.source === 'local') await local.recordSession(game.nativeId, new Date(Date.now() - durationMs), durationMs)
      // Steam sube las horas al terminar la partida: el próximo refresco las vuelve a pedir.
      else storePlaytime.invalidate(game.source)
      // Como en una consola: terminás de jugar y volvés al inicio.
      curtain.setListenerActive(true)
      curtain.down()
      send('ended', durationMs)
    },
    onNeverStarted: () => {
      trackedGameId = null
      send('not-started')
    },
  })
})

ipcMain.handle(IPC.renameLocal, async (_event, gameId: unknown, title: unknown): Promise<LibraryDTO> => {
  if (typeof gameId !== 'string' || typeof title !== 'string') throw new Error('Datos inválidos')
  const game = catalog.get(gameId)
  if (!game || game.source !== 'local') throw new Error('Solo se puede renombrar un juego local')
  await local.rename(game.nativeId, title) // la regla del nombre la aplica el dominio
  return await library()
})

ipcMain.handle(IPC.setManualPlaytime, async (_event, gameId: unknown, hours: unknown): Promise<LibraryDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  // Límite razonable: 100.000 h son más de 11 años sin dormir.
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0 || hours > 100_000) {
    throw new Error('Ingresá una cantidad de horas válida')
  }
  const game = catalog.get(gameId)
  if (!game || game.source !== 'local') throw new Error('Solo se puede ajustar el tiempo de juegos locales')
  await local.setManualPlaytime(game.nativeId, hours * 3_600_000)
  return await library()
})

ipcMain.handle(IPC.openFolder, async (_event, gameId: unknown) => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  const game = catalog.get(gameId)
  if (!game) throw new Error('Ese juego no está en la biblioteca')
  const failure = await shell.openPath(game.installDir) // devuelve "" si salió bien
  if (failure) throw new Error(`No se pudo abrir la carpeta: ${failure}`)
})

ipcMain.handle(IPC.uninstallPreview, async (_event, gameId: unknown): Promise<UninstallPreviewDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  const game = catalog.get(gameId)
  if (!game || game.source !== 'local') throw new Error('Solo los juegos locales tienen vista previa')
  return local.previewUninstall(game)
})

ipcMain.handle(IPC.uninstall, async (_event, gameId: unknown): Promise<UninstallResultDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  if (catalog.get(gameId) && sessionsBusyWith(gameId)) throw new Error('Cerrá el juego antes de desinstalarlo')
  const outcome = await catalog.uninstall(gameId)
  // Si se borró, también sus imágenes (las de la carpeta del hub; no las tuyas).
  if (outcome === 'removed') await artwork.clear(gameId).catch(() => {})
  return { outcome, library: await library() }
})

// Juego que el hub está siguiendo en este momento (lanzado y todavía abierto).
let trackedGameId: string | null = null
function sessionsBusyWith(gameId: string): boolean {
  return trackedGameId === gameId
}

ipcMain.handle(IPC.addLocal, async (event): Promise<{ library: LibraryDTO; addedId: string } | null> => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: 'Elegí el ejecutable del juego',
    properties: ['openFile'],
    filters: [{ name: 'Juegos', extensions: ['exe'] }],
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const exe = result.filePaths[0]
  if (result.canceled || !exe) return null

  const record = await local.add(exe)
  return { library: await library(), addedId: `local:${record.id}` }
})

ipcMain.handle(IPC.removeLocal, async (_event, gameId: unknown): Promise<LibraryDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  const game = catalog.get(gameId)
  if (!game || game.source !== 'local') throw new Error('Solo se pueden quitar juegos locales')
  await local.remove(game.nativeId)
  return await library()
})

// --- Cortina ---

ipcMain.handle(IPC.curtainState, (): CurtainState => curtain.current)

ipcMain.handle(IPC.setCurtain, (_event, state: unknown) => {
  if (state !== 'up' && state !== 'down') throw new Error('Estado inválido')
  curtain.set(state)
})

// --- Imágenes de juegos locales ---

ipcMain.handle(IPC.artworkSearch, async (_event, term: unknown): Promise<ArtworkCandidateDTO[]> => {
  if (typeof term !== 'string' || term.length > 200) throw new Error('Búsqueda inválida')
  return artwork.search(term)
})

ipcMain.handle(IPC.artworkApply, async (_event, gameId: unknown, candidateId: unknown): Promise<LibraryDTO> => {
  if (typeof gameId !== 'string' || typeof candidateId !== 'string') throw new Error('Datos inválidos')
  await artwork.applyCandidate(gameId, candidateId)
  return await library()
})

ipcMain.handle(IPC.artworkPickFile, async (event, gameId: unknown, kind: unknown): Promise<LibraryDTO | null> => {
  if (typeof gameId !== 'string' || (kind !== 'cover' && kind !== 'hero')) throw new Error('Datos inválidos')
  const win = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: kind === 'cover' ? 'Elegí la portada (vertical)' : 'Elegí el fondo (panorámico)',
    properties: ['openFile'],
    filters: [{ name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const file = result.filePaths[0]
  if (result.canceled || !file) return null

  await artwork.applyFile(gameId, kind, file)
  return await library()
})

ipcMain.handle(IPC.artworkClear, async (_event, gameId: unknown): Promise<LibraryDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  await artwork.clear(gameId)
  return await library()
})

ipcMain.handle(IPC.sgdbKeyStatus, async () => (await sgdbKey.get()) !== null)

ipcMain.handle(IPC.setSgdbKey, async (_event, key: unknown): Promise<boolean> => {
  if (typeof key !== 'string' || !/^[A-Za-z0-9]{16,64}$/.test(key.trim())) throw new Error('Esa no parece una key de SteamGridDB')
  let valid = false
  try {
    valid = await sgdb.verifyKey(key.trim())
  } catch {
    valid = false
  }
  if (!valid) throw new Error('SteamGridDB rechazó la key. Revisá que esté bien copiada.')
  await sgdbKey.set(key.trim())
  return true
})

// URL FIJA, igual que con Steam.
ipcMain.handle(IPC.openSgdbKeyPage, () => shell.openExternal('https://www.steamgriddb.com/profile/preferences/api'))

// Descarga una imagen. null si no existe o si lo que llega NO es una imagen.
async function fetchImage(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// --- Logros ---

ipcMain.handle(IPC.achievements, async (_event, gameId: unknown): Promise<AchievementsDTO> => {
  if (typeof gameId !== 'string') throw new Error('Id inválido')
  return toAchievementsDTO(await achievements.get(gameId))
})

ipcMain.handle(IPC.steamKeyStatus, () => keyStatus())

ipcMain.handle(IPC.setSteamKey, async (_event, key: unknown): Promise<SteamKeyStatusDTO> => {
  if (typeof key !== 'string' || !isValidApiKeyFormat(key.trim())) {
    throw new Error('La key tiene que tener 32 caracteres (letras A-F y números)')
  }
  const steamId = await detectSteamId()
  if (!steamId) throw new Error('No encontré tu cuenta de Steam en esta PC. ¿Iniciaste sesión en Steam alguna vez?')
  if (!(await steamAchievements.verifyKey(key.trim(), steamId))) throw new Error('Steam rechazó la key. Revisá que esté bien copiada.')

  await steamKey.set(key.trim())
  achievements.invalidate()
  storePlaytime.invalidate('steam')
  return keyStatus()
})

ipcMain.handle(IPC.clearSteamKey, async () => {
  await steamKey.clear()
  achievements.invalidate()
  storePlaytime.invalidate('steam')
  return keyStatus()
})

// URL FIJA: la UI no puede pedirle a Main que abra cualquier dirección.
ipcMain.handle(IPC.openSteamKeyPage, () => shell.openExternal('https://steamcommunity.com/dev/apikey'))

async function keyStatus(): Promise<SteamKeyStatusDTO> {
  return { configured: (await steamKey.get()) !== null, steamIdFound: (await detectSteamId()) !== null }
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<HttpResult> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // cuerpo vacío o HTML (Steam devuelve HTML cuando la key es inválida)
  }
  return { ok: res.ok, status: res.status, body }
}

// --- Sistema operativo ---

// Lanza el .exe con SU carpeta como directorio de trabajo: muchos juegos buscan sus archivos ahí.
// detached + unref: el juego sigue vivo aunque cierres el hub.
function spawnGame(executable: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { cwd: dirname(executable), detached: true, stdio: 'ignore' })
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
    child.once('error', async () => {
      // spawn no puede pedir permisos de administrador. ShellExecute (openPath) sí muestra el UAC.
      const failure = await shell.openPath(executable)
      if (failure) reject(new Error(`No se pudo iniciar el juego: ${failure}`))
      else resolve()
    })
  })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

// --- Dominio -> DTO ---

// La biblioteca (local, rápida) y las horas de las tiendas (red, con caché) se piden EN PARALELO.
async function library(): Promise<LibraryDTO> {
  const [snapshot, store] = await Promise.all([catalog.refresh(), storePlaytime.all()])
  return { games: snapshot.games.map((g) => toGameDTO(g, store.get(g.id))), errors: snapshot.errors }
}

function toGameDTO(game: Game, store?: StorePlaytime): GameDTO {
  // ?v=<archivo>: si la imagen cambia, cambia la URL, y Chromium no muestra la vieja desde su caché.
  const media = (kind: string, path: string) =>
    `media://game/${encodeURIComponent(game.id)}/${kind}?v=${encodeURIComponent(basename(path))}`
  return {
    id: game.id,
    source: game.source,
    title: game.title,
    installDir: game.installDir,
    sizeBytes: game.sizeBytes,
    lastPlayed: game.lastPlayed?.getTime() ?? null,
    playtime: toPlaytimeDTO(game, store),
    coverUrl: game.coverPath ? media('cover', game.coverPath) : null,
    heroUrl: game.heroPath ? media('hero', game.heroPath) : null,
  }
}

function toPlaytimeDTO(game: Game, store?: StorePlaytime): PlaytimeDTO | null {
  if (game.playtime) return toHubPlaytimeDTO(summarizePlaytime(game.playtime, new Date()))
  if (store) return { kind: 'store', store: game.source, totalMs: store.totalMs, recentMs: store.recentMs }
  return null
}

function toHubPlaytimeDTO(s: PlaytimeSummary): PlaytimeDTO {
  return {
    kind: 'hub',
    ...s,
    lastSession: s.lastSession ? { startedAt: s.lastSession.startedAt.getTime(), durationMs: s.lastSession.durationMs } : null,
  }
}

function toAchievementsDTO(result: AchievementResult): AchievementsDTO {
  if (result.status !== 'ok') return result
  return {
    ...result,
    achievements: result.achievements.map((a) => ({ ...a, unlockedAt: a.unlockedAt?.getTime() ?? null })),
  }
}

// --- Ciclo de vida ---

// UNA sola instancia: si ya está corriendo (por ejemplo, desde el inicio de Windows) y la abrís
// de nuevo, no se crea otra: la que existe baja la cortina.
const ATAJO = 'CommandOrControl+Alt+G'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => curtain?.down())

  void app.whenReady().then(() => {
    compose()
    protocol.handle('media', serveMedia)
    createWindows()
    createTray()
    void enableAutostartOnFirstRun().then(refreshTrayMenu)
    // Atajo global: la alternativa sin mando. Funciona siempre, también con un juego abierto.
    if (!globalShortcut.register(ATAJO, () => curtain.toggle())) console.warn(`[hub] el atajo ${ATAJO} está ocupado`)
  })

  app.on('before-quit', () => {
    quitting = true
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
