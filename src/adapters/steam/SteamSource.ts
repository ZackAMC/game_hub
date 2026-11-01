// ADAPTADOR: implementa GameSource leyendo la instalación de Steam.
// Steam no tiene una API local para esto: leemos sus archivos de configuración.

import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gameId, type Game } from '../../domain/Game.js'
import type { GameSource, UninstallOutcome } from '../../domain/ports/GameSource.js'
import { parseAppManifest, parseLibraryFolders, type SteamApp } from './manifests.js'
import { exists, findSteamPath } from './steamPath.js'

const execFileAsync = promisify(execFile)
const MANIFEST =/^appmanifest_\d+\.acf$/

export class SteamSource implements GameSource {
  readonly id = 'steam' as const

  // openUrl se inyecta: en la app es shell.openExternal de Electron, en un test sería un fake.
  constructor(private readonly openUrl: (url: string) => Promise<void>) {}

  async list(): Promise<Game[]> {
    const steamPath = await findSteamPath()
    if (!steamPath) throw new Error('No encontré una instalación de Steam')

    const libraries = await readLibraries(steamPath)
    const games: Game[] = []
    for (const library of libraries) {
      for (const app of await readManifests(library)) games.push(await toGame(app, library, steamPath))
    }
    return games
  }

  async launch(game: Game): Promise<void> {
    // Steam se encarga de todo: actualizaciones, DRM, overlay. Nosotros solo se lo pedimos.
    await this.openUrl(`steam://rungameid/${game.nativeId}`)
  }

  // Steam muestra SU confirmación y desinstala él: maneja DLCs, contenido de Workshop, etc.
  async uninstall(game: Game): Promise<UninstallOutcome> {
    await this.openUrl(`steam://uninstall/${game.nativeId}`)
    return 'delegated'
  }

  // Steam publica en el registro el appid del juego que está corriendo (0 = ninguno).
  async isRunning(game: Game): Promise<boolean> {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'])
    return parseRunningAppId(stdout) === game.nativeId
  }
}

// PURA: "RunningAppID    REG_DWORD    0x3d814" -> "251924". null si no hay juego corriendo.
export function parseRunningAppId(regOutput: string): string | null {
  const match = /RunningAppID\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(regOutput)
  if (!match?.[1]) return null
  const appid = parseInt(match[1], 16)
  return appid > 0 ? String(appid) : null
}

async function readLibraries(steamPath: string): Promise<string[]> {
  try {
    const text = await readFile(join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    const paths = parseLibraryFolders(text)
    return paths.length > 0 ? paths : [steamPath]
  } catch {
    return [steamPath]
  }
}

async function readManifests(library: string): Promise<SteamApp[]> {
  const dir = join(library, 'steamapps')
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => MANIFEST.test(f))
  } catch {
    return [] // biblioteca en un disco desconectado: la salteamos
  }

  const apps: SteamApp[] = []
  for (const file of files) {
    try {
      const app = parseAppManifest(await readFile(join(dir, file), 'utf8'))
      if (app) apps.push(app)
    } catch {
      // un manifiesto corrupto no debería esconder al resto
    }
  }
  return apps
}

async function toGame(app: SteamApp, library: string, steamPath: string): Promise<Game> {
  const artDir = join(steamPath, 'appcache', 'librarycache', app.appid)
  return {
    id: gameId('steam', app.appid),
    source: 'steam',
    nativeId: app.appid,
    title: app.name,
    installDir: join(library, 'steamapps', 'common', app.installdir),
    executable: null,
    sizeBytes: app.sizeBytes,
    lastPlayed: app.lastPlayed,
    playtime: null, // Steam lo sabe, pero no lo expone en los archivos locales
    coverPath: await findArt(artDir, ['library_600x900.jpg', 'library_header.jpg', 'header.jpg']),
    heroPath: await findArt(artDir, ['library_hero.jpg']),
  }
}

// Las imágenes están en librarycache/<appid>/ o UN nivel más adentro, en subcarpetas con nombre de hash.
async function findArt(dir: string, names: string[]): Promise<string | null> {
  let subdirs: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    subdirs = entries.filter((e) => e.isDirectory()).map((e) => join(dir, e.name))
  } catch {
    return null // este juego no tiene imágenes en caché
  }

  for (const name of names) {
    for (const base of [dir, ...subdirs]) {
      const candidate = join(base, name)
      if (await exists(candidate)) return candidate
    }
  }
  return null
}
