// CONTENEDOR: estado + comunicación con `window.hub`. Los componentes de abajo solo pintan.
//
// Dos vistas, como en una consola:
//   INICIO  -> elegís un juego en la fila (sin botones, limpio)
//   JUEGO   -> Jugar · Info · ⋯ (opciones)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ArtworkKindDTO, GameDTO, LibraryDTO, SessionDTO, SourceDTO, SteamKeyStatusDTO } from '../../shared/contract'
import { formatBytes, formatDuration, timeAgo } from '../../shared/format'
import { AchievementSummary } from './components/AchievementSummary'
import { AchievementsPanel } from './components/AchievementsPanel'
import { ArtworkDialog } from './components/ArtworkDialog'
import { Backdrop } from './components/Backdrop'
import { ControllerHints } from './components/ControllerHints'
import { GamePage, PAGE_ACTIONS, type MenuItem, type PageAction } from './components/GamePage'
import { GameShelf } from './components/GameShelf'
import { HomeSummary } from './components/HomeSummary'
import { PlaytimeDialog } from './components/PlaytimeDialog'
import { PlaytimeStats } from './components/PlaytimeStats'
import { SteamKeyDialog } from './components/SteamKeyDialog'
import { Toast, type ToastMessage } from './components/Toast'
import { TopBar, type Filter } from './components/TopBar'
import { UninstallDialog, type UninstallChoice } from './components/UninstallDialog'
import type { PadKind } from './input/gamepad'
import { GamepadDebug } from './input/GamepadDebug'
import { useGamepad } from './input/useGamepad'
import { sounds } from './sound/SoundEngine'
import { useAchievements } from './useAchievements'
import { useNavigation, type NavAction } from './useNavigation'

type View = 'home' | 'game'
type Modal = 'none' | 'achievements' | 'steam-key' | 'artwork' | 'playtime' | 'uninstall'

// Un ítem del menú ⋯: lo que se ve (MenuItem) + lo que hace.
interface MenuEntry extends MenuItem {
  run: () => void
  needsConfirm?: boolean // acciones destructivas: hay que elegirlas dos veces
}

const FILTER_ORDER: Filter[] = ['all', 'steam', 'local']
const PAD_NAMES: Record<PadKind, string> = { playstation: 'PlayStation', xbox: 'Xbox', generic: 'genérico' }

export function App() {
  const [library, setLibrary] = useState<LibraryDTO | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [session, setSession] = useState<SessionDTO | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [muted, setMuted] = useState(() => sounds.isMuted())
  const [fullscreen, setFullscreen] = useState(false)
  const [modal, setModal] = useState<Modal>('none')
  const [keyStatus, setKeyStatus] = useState<SteamKeyStatusDTO | null>(null)
  const [padDebug, setPadDebug] = useState(false)
  const achievementsListRef = useRef<HTMLDivElement>(null)

  // Estado de la página del juego. Es el "foco propio": teclado, mando y mouse mueven esto.
  const [view, setView] = useState<View>('home')
  const [pageFocus, setPageFocus] = useState<PageAction>('play')
  const [infoOpen, setInfoOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null) // id del ítem esperando confirmación
  const [uninstallFocus, setUninstallFocus] = useState<UninstallChoice>('cancel')
  const [uninstalling, setUninstalling] = useState(false)

  // F9: panel de diagnóstico de mandos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') setPadDebug((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const notify = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
    setToast({ id: Date.now(), text, kind })
    if (kind === 'error') sounds.error()
  }, [])
  // Referencia ESTABLE: si fuera una flecha nueva en cada render, el timer del Toast se reiniciaría siempre.
  const clearToast = useCallback(() => setToast(null), [])

  const applyLibrary = useCallback(
    (lib: LibraryDTO) => {
      setLibrary(lib)
      for (const e of lib.errors) notify(`${sourceName(e.source)}: ${e.message}`, 'error')
    },
    [notify],
  )

  useEffect(() => {
    window.hub.list().then(applyLibrary, (err: unknown) => notify(message(err), 'error'))
  }, [applyLibrary, notify])

  // Estado inicial + suscripción. onFullscreenChange devuelve la desuscripción para el cleanup.
  useEffect(() => {
    void window.hub.isFullscreen().then(setFullscreen)
    return window.hub.onFullscreenChange(setFullscreen)
  }, [])

  const visible = useMemo(
    () => (library?.games ?? []).filter((g) => filter === 'all' || g.source === filter),
    [library, filter],
  )
  const selected = visible.find((g) => g.id === selectedId) ?? visible[0] ?? null
  const ach = useAchievements(selected?.id ?? null, selected?.source === 'steam')

  useEffect(() => {
    void window.hub.steamKeyStatus().then(setKeyStatus)
  }, [])

  // Al volver a la ventana, refrescamos: así aparecen los juegos que Steam desinstaló
  // (o instaló) mientras estabas en otra cosa. Con un mínimo de 3 s entre refrescos.
  useEffect(() => {
    let last = 0
    const onFocus = () => {
      if (Date.now() - last < 3000) return
      last = Date.now()
      void window.hub.list().then(applyLibrary)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [applyLibrary])

  // Si el juego de la página que estás viendo dejó de existir (desinstalado), volvemos al inicio.
  useEffect(() => {
    if (view === 'game' && library && selectedId && !library.games.some((g) => g.id === selectedId)) setView('home')
  }, [library, view, selectedId])

  // ---------- Acciones sobre juegos ----------

  async function launch(game: GameDTO) {
    setSession({ gameId: game.id, state: 'starting', durationMs: null })
    sounds.launch()
    notify(`Iniciando ${game.title}…`)
    try {
      await window.hub.launch(game.id)
      // Desde acá, Main avisa cada cambio de la sesión por onSessionChange.
    } catch (err) {
      setSession(null)
      notify(message(err), 'error')
    }
  }

  // Main nos dice cuándo arrancó y cuándo terminó el juego.
  useEffect(
    () =>
      window.hub.onSessionChange((s) => {
        if (s.state === 'ended') {
          setSession(null)
          setSelectedId(s.gameId)
          sounds.confirm()
          notify(`¡De vuelta! Jugaste ${formatDuration(s.durationMs ?? 0)}`, 'success')
          void window.hub.list().then(applyLibrary) // trae "jugado hace…" y el tiempo total actualizados
        } else if (s.state === 'not-started') {
          setSession(null)
          notify('No detecté que el juego arrancara. Si está abierto, todo bien: el hub simplemente no va a volver solo.')
        } else {
          setSession(s)
        }
      }),
    [applyLibrary, notify],
  )

  async function addLocal() {
    try {
      const result = await window.hub.addLocal()
      if (result) {
        applyLibrary(result.library)
        sounds.confirm()
        notify('Juego agregado a la biblioteca', 'success')
        // Seleccionamos el juego nuevo, entramos a su página y abrimos el buscador de imágenes.
        if (filter === 'steam') setFilter('all') // si no, el juego recién agregado no se vería
        setSelectedId(result.addedId)
        enterGame(false)
        setModal('artwork')
      }
    } catch (err) {
      notify(message(err), 'error')
    }
  }

  async function removeLocal(game: GameDTO) {
    try {
      applyLibrary(await window.hub.removeLocal(game.id))
      sounds.back()
      setView('home') // el juego ya no existe: no tiene sentido quedarse en su página
      notify(`${game.title} se quitó de la biblioteca (los archivos siguen en el disco)`)
    } catch (err) {
      notify(message(err), 'error')
    }
  }

  // Steam: le pasamos la posta y Steam pide su propia confirmación.
  async function uninstallSteam(game: GameDTO) {
    try {
      await window.hub.uninstall(game.id)
      notify(`Steam te va a pedir confirmación para desinstalar ${game.title}`)
    } catch (err) {
      notify(message(err), 'error')
    }
  }

  function openUninstall() {
    setUninstallFocus('cancel') // por defecto, NO borrar
    openModal('uninstall')
  }

  async function chooseUninstall(choice: UninstallChoice, game: GameDTO, allowed: boolean) {
    if (choice === 'cancel') return closeModal()
    if (!allowed || uninstalling) return
    setUninstalling(true)
    try {
      const result = await window.hub.uninstall(game.id)
      applyLibrary(result.library)
      sounds.back()
      setModal('none')
      setView('home')
      notify(`${game.title} se desinstaló. Está en la Papelera por si te arrepentís.`, 'success')
    } catch (err) {
      notify(message(err), 'error')
    } finally {
      setUninstalling(false)
    }
  }

  async function openFolder(game: GameDTO) {
    try {
      await window.hub.openFolder(game.id)
    } catch (err) {
      notify(message(err), 'error')
    }
  }

  // ---------- Logros, imágenes, tiempo ----------

  async function saveSteamKey(key: string) {
    setKeyStatus(await window.hub.setSteamKey(key)) // si falla, el diálogo muestra el error
    sounds.confirm()
    notify('Cuenta de Steam conectada', 'success')
    setModal('none')
    ach.reload()
  }

  async function clearSteamKey() {
    setKeyStatus(await window.hub.clearSteamKey())
    sounds.back()
    ach.reload()
  }

  async function applyArtwork(gameId: string, candidateId: string) {
    applyLibrary(await window.hub.artworkApply(gameId, candidateId))
    sounds.confirm()
    setModal('none')
  }

  async function pickArtworkFile(gameId: string, kind: ArtworkKindDTO) {
    const lib = await window.hub.artworkPickFile(gameId, kind)
    if (lib) {
      applyLibrary(lib)
      sounds.confirm()
    }
  }

  async function clearArtwork(gameId: string) {
    applyLibrary(await window.hub.artworkClear(gameId))
    sounds.back()
  }

  function openModal(next: Modal) {
    sounds.confirm()
    setModal(next)
  }

  function closeModal() {
    sounds.back()
    setModal('none')
  }

  // ---------- Página del juego ----------

  function enterGame(withMenu: boolean) {
    sounds.confirm()
    setView('game')
    setPageFocus(withMenu ? 'more' : 'play')
    setInfoOpen(false)
    setMenuOpen(withMenu)
    setMenuIndex(0)
    setPendingConfirm(null)
  }

  function leaveGame() {
    sounds.back()
    setView('home')
    setMenuOpen(false)
  }

  // Las opciones dependen del juego: cada fuente ofrece lo que tiene sentido.
  const menuEntries: MenuEntry[] = !selected
    ? []
    : [
        ...(selected.source === 'steam' && ach.data?.status === 'ok'
          ? [{ id: 'achievements', label: 'Ver logros', run: () => openModal('achievements') }]
          : []),
        ...(selected.source === 'steam' && ach.data?.status === 'not-configured'
          ? [{ id: 'steam-key', label: 'Conectar logros de Steam', run: () => openModal('steam-key') }]
          : []),
        ...(selected.source === 'local'
          ? [
              { id: 'artwork', label: 'Cambiar imagen', run: () => openModal('artwork') },
              { id: 'playtime', label: 'Tiempo previo', run: () => openModal('playtime') },
            ]
          : []),
        { id: 'folder', label: 'Abrir carpeta del juego', run: () => void openFolder(selected) },
        {
          id: 'uninstall',
          label: 'Desinstalar',
          danger: true,
          run: () => (selected.source === 'steam' ? void uninstallSteam(selected) : openUninstall()),
        },
        ...(selected.source === 'local'
          ? [
              {
                id: 'remove',
                label: pendingConfirm === 'remove' ? '¿Seguro? Elegilo de nuevo para quitar' : 'Quitar de la biblioteca',
                danger: true,
                needsConfirm: true,
                run: () => void removeLocal(selected),
              },
            ]
          : []),
      ]

  function selectMenuEntry(index: number) {
    const entry = menuEntries[index]
    if (!entry) return
    // Destructivo: la primera vez solo pide confirmación. Un toque de más no te borra nada.
    if (entry.needsConfirm && pendingConfirm !== entry.id) {
      sounds.tick()
      setPendingConfirm(entry.id)
      return
    }
    setMenuOpen(false)
    setPendingConfirm(null)
    entry.run()
  }

  function activatePage(action: PageAction) {
    if (!selected) return
    setPageFocus(action)
    if (action === 'play') {
      if (session === null) void launch(selected)
    } else if (action === 'info') {
      sounds.tick()
      setInfoOpen((v) => !v)
      setMenuOpen(false)
    } else {
      sounds.confirm()
      setMenuOpen((v) => !v)
      setMenuIndex(0)
      setPendingConfirm(null)
    }
  }

  // ---------- Entrada: teclado y mando terminan acá ----------

  function handleAction(action: NavAction) {
    // Con un diálogo abierto, las acciones son DEL diálogo.
    if (modal === 'uninstall') {
      if (action === 'left' || action === 'right') {
        sounds.move()
        setUninstallFocus((f) => (f === 'cancel' ? 'confirm' : 'cancel'))
      }
      // El "allowed" real lo decide Main; acá solo evitamos un pedido inútil si ya sabemos que no.
      if (action === 'confirm' && selected) void chooseUninstall(uninstallFocus, selected, true)
      if (action === 'back') closeModal()
      return
    }
    if (modal !== 'none') {
      if (action === 'back') closeModal()
      if (modal === 'achievements' && (action === 'up' || action === 'down')) {
        achievementsListRef.current?.scrollBy({ top: action === 'down' ? 160 : -160, behavior: 'smooth' })
      }
      return
    }

    if (view === 'game') return handleGameAction(action)

    // INICIO
    if (action === 'prevTab' || action === 'nextTab') {
      const i = FILTER_ORDER.indexOf(filter)
      changeFilter(FILTER_ORDER[(i + (action === 'nextTab' ? 1 : -1) + FILTER_ORDER.length) % FILTER_ORDER.length]!)
      return
    }
    if (visible.length === 0) return
    const index = selected ? visible.indexOf(selected) : 0
    if (action === 'left') moveTo(index - 1)
    if (action === 'right') moveTo(index + 1)
    if (action === 'confirm' && selected) enterGame(false)
    if (action === 'secondary' && selected) enterGame(true) // △ / Y: directo a las opciones
  }

  function handleGameAction(action: NavAction) {
    if (menuOpen) {
      if (action === 'up' || action === 'down') {
        const next = menuIndex + (action === 'down' ? 1 : -1)
        if (next < 0 || next >= menuEntries.length) return sounds.edge()
        sounds.move()
        setMenuIndex(next)
        setPendingConfirm(null) // moverse cancela una confirmación pendiente
      }
      if (action === 'confirm') selectMenuEntry(menuIndex)
      if (action === 'back' || action === 'secondary') {
        sounds.back()
        setMenuOpen(false)
        setPendingConfirm(null)
      }
      return
    }

    if (action === 'left' || action === 'right') {
      const i = PAGE_ACTIONS.indexOf(pageFocus)
      const next = PAGE_ACTIONS[i + (action === 'right' ? 1 : -1)]
      if (!next) return sounds.edge()
      sounds.move()
      setPageFocus(next)
    }
    if (action === 'confirm') activatePage(pageFocus)
    if (action === 'secondary') activatePage('more')
    if (action === 'back') leaveGame()
  }

  useNavigation(handleAction)
  const padKind = useGamepad(handleAction)

  // Aviso al conectar o desconectar un mando. El ref recuerda el estado anterior para saber qué pasó.
  const previousPad = useRef<PadKind | null>(null)
  useEffect(() => {
    if (padKind && !previousPad.current) {
      sounds.confirm()
      notify(`Mando ${PAD_NAMES[padKind]} conectado`, 'success')
    } else if (!padKind && previousPad.current) {
      notify('Mando desconectado')
    }
    previousPad.current = padKind
  }, [padKind, notify])

  // Moverse suena distinto a chocar contra el borde: el oído te avisa que no hay más.
  function moveTo(index: number) {
    const target = visible[index]
    if (!target) {
      sounds.edge()
      return
    }
    sounds.move()
    setSelectedId(target.id)
  }

  // Clic en la fila: el primero selecciona; sobre el ya seleccionado, entra a su página.
  function clickGame(game: GameDTO) {
    if (game.id === selected?.id) return enterGame(false)
    sounds.move()
    setSelectedId(game.id)
  }

  function changeFilter(next: Filter) {
    if (next === filter) return
    sounds.tick()
    setFilter(next)
    setSelectedId(null) // vuelve al primer juego del filtro nuevo
  }

  function toggleMute() {
    const next = !muted
    sounds.setMuted(next)
    setMuted(next)
    if (!next) sounds.tick() // confirmación audible de que volvió el sonido
  }

  function toggleFullscreen() {
    sounds.tick()
    void window.hub.toggleFullscreen()
  }

  // Ayuda del mando según dónde estés.
  const hints =
    modal !== 'none'
      ? { confirm: null, back: 'Cerrar', secondary: null, tabs: false }
      : view === 'home'
        ? { confirm: selected ? 'Abrir' : null, back: null, secondary: selected ? 'Opciones' : null, tabs: true }
        : menuOpen
          ? { confirm: 'Elegir', back: 'Cerrar', secondary: null, tabs: false }
          : {
              confirm: pageFocus === 'play' ? 'Jugar' : pageFocus === 'info' ? 'Info' : 'Opciones',
              back: 'Volver',
              secondary: 'Opciones',
              tabs: false,
            }

  return (
    <div className={`hub view-${view}`}>
      <Backdrop game={selected} />
      <TopBar
        filter={filter}
        onFilter={changeFilter}
        onAdd={addLocal}
        muted={muted}
        onToggleMute={toggleMute}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <main className="stage">
        {library === null ? (
          <p className="hint">Buscando tus juegos…</p>
        ) : visible.length === 0 ? (
          <div className="empty">
            <h1>Tu biblioteca está vacía</h1>
            <p className="hint">
              {filter === 'local' ? 'Agregá un juego eligiendo su .exe.' : 'No encontré juegos para este filtro.'}
            </p>
            <button className="btn primary" onClick={addLocal}>
              Agregar juego
            </button>
          </div>
        ) : selected && view === 'home' ? (
          <HomeSummary game={selected} />
        ) : (
          selected && (
            <GamePage
              game={selected}
              focus={pageFocus}
              onFocus={setPageFocus}
              onActivate={activatePage}
              session={session?.gameId === selected.id ? session.state : null}
              busy={session !== null}
              infoOpen={infoOpen}
              summary={selected.playtime && <PlaytimeStats playtime={selected.playtime} />}
              info={
                <GameInfo
                  game={selected}
                  achievements={
                    <AchievementSummary
                      data={ach.data}
                      loading={ach.loading}
                      onOpen={() => openModal('achievements')}
                      onConnect={() => openModal('steam-key')}
                      onRetry={() => {
                        sounds.tick()
                        ach.reload()
                      }}
                    />
                  }
                />
              }
              menuOpen={menuOpen}
              menuItems={menuEntries}
              menuIndex={menuIndex}
              onMenuHover={setMenuIndex}
              onMenuSelect={selectMenuEntry}
            />
          )
        )}
      </main>

      {view === 'home' && visible.length > 0 && (
        <GameShelf games={visible} selectedId={selected?.id ?? null} onSelect={clickGame} onActivate={() => enterGame(false)} />
      )}

      {padDebug && <GamepadDebug onClose={() => setPadDebug(false)} />}

      {padKind && (
        <ControllerHints
          kind={padKind}
          confirmLabel={hints.confirm}
          backLabel={hints.back}
          secondaryLabel={hints.secondary}
          showTabs={hints.tabs}
        />
      )}

      {modal === 'achievements' && selected && ach.data?.status === 'ok' && (
        <AchievementsPanel
          ref={achievementsListRef}
          game={selected}
          achievements={ach.data.achievements}
          unlocked={ach.data.unlocked}
          total={ach.data.total}
          onClose={closeModal}
        />
      )}
      {modal === 'artwork' && selected?.source === 'local' && (
        <ArtworkDialog
          key={selected.id}
          game={selected}
          onApply={(candidateId) => applyArtwork(selected.id, candidateId)}
          onPickFile={(kind) => pickArtworkFile(selected.id, kind)}
          onClear={() => clearArtwork(selected.id)}
          onClose={closeModal}
        />
      )}
      {modal === 'playtime' && selected?.source === 'local' && (
        <PlaytimeDialog
          key={selected.id}
          game={selected}
          onSave={async (hours) => {
            applyLibrary(await window.hub.setManualPlaytime(selected.id, hours))
            sounds.confirm()
            setModal('none')
          }}
          onClose={closeModal}
        />
      )}
      {modal === 'uninstall' && selected?.source === 'local' && (
        <UninstallDialog
          key={selected.id}
          game={selected}
          focus={uninstallFocus}
          onFocus={setUninstallFocus}
          working={uninstalling}
          onChoose={(choice, preview) => void chooseUninstall(choice, selected, preview?.allowed === true)}
        />
      )}
      {modal === 'steam-key' && (
        <SteamKeyDialog status={keyStatus} onSave={saveSteamKey} onClear={clearSteamKey} onClose={closeModal} />
      )}

      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}

// Contenido del panel "Info". El tiempo de juego NO va acá: se ve siempre, arriba de los botones.
function GameInfo({ game, achievements }: { game: GameDTO; achievements: React.ReactNode }) {
  const facts = [
    game.source === 'steam' ? 'Steam' : 'Local',
    game.lastPlayed ? `Jugado ${timeAgo(game.lastPlayed)}` : 'Nunca jugado',
    game.sizeBytes ? formatBytes(game.sizeBytes) : null,
  ].filter(Boolean)

  return (
    <>
      <p className="meta">{facts.join('  ·  ')}</p>
      {achievements}
      <p className="path" title={game.installDir}>
        {game.installDir}
      </p>
    </>
  )
}

function sourceName(source: SourceDTO): string {
  return source === 'steam' ? 'Steam' : 'Locales'
}

function message(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  // Electron envuelve los errores de IPC: "Error invoking remote method 'x': Error: <mensaje>"
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
