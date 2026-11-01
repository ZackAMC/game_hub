// CONTRATO entre Main y Renderer: lo ÚNICO que cruza el puente IPC. Solo datos planos.

export const IPC = {
  list: 'games:list',
  launch: 'games:launch',
  addLocal: 'games:add-local',
  removeLocal: 'games:remove-local',
  toggleFullscreen: 'window:toggle-fullscreen',
  isFullscreen: 'window:is-fullscreen',
  fullscreenChanged: 'window:fullscreen-changed',
  achievements: 'achievements:get',
  steamKeyStatus: 'steam-key:status',
  setSteamKey: 'steam-key:set',
  clearSteamKey: 'steam-key:clear',
  openSteamKeyPage: 'steam-key:open-page',
  artworkSearch: 'artwork:search',
  artworkApply: 'artwork:apply',
  artworkPickFile: 'artwork:pick-file',
  artworkClear: 'artwork:clear',
  sessionChanged: 'session:changed',
  setManualPlaytime: 'playtime:set-manual',
  renameLocal: 'games:rename-local',
  openFolder: 'games:open-folder',
  uninstallPreview: 'games:uninstall-preview',
  uninstall: 'games:uninstall',
  sgdbKeyStatus: 'sgdb-key:status',
  setSgdbKey: 'sgdb-key:set',
  openSgdbKeyPage: 'sgdb-key:open-page',
} as const

export interface ArtworkCandidateDTO {
  id: string
  title: string
  thumbUrl: string | null
  sourceLabel: string
}

export type ArtworkKindDTO = 'cover' | 'hero'

export type SourceDTO = 'steam' | 'local'

export interface GameDTO {
  id: string
  source: SourceDTO
  title: string
  installDir: string
  sizeBytes: number | null
  lastPlayed: number | null // epoch en ms: un número cruza IPC sin ambigüedades
  playtime: PlaytimeDTO | null // null = sin datos (Steam sin API key, perfil privado, nunca jugado)
  coverUrl: string | null // media://... servido por Main, nunca una ruta de disco
  heroUrl: string | null
}

// Resúmenes YA calculados por Main: la UI solo los muestra.
// Dos ORÍGENES con datos distintos: no se fuerzan a la misma forma.
export type PlaytimeDTO = HubPlaytimeDTO | StorePlaytimeDTO

// Medido por el hub: hay sesiones, así que hay semana, mes y última sesión.
export interface HubPlaytimeDTO {
  kind: 'hub'
  totalMs: number
  measuredMs: number
  manualMs: number
  weekMs: number
  monthMs: number
  lastSession: { startedAt: number; durationMs: number } | null
}

// Informado por la tienda: solo lo que ella expone.
export interface StorePlaytimeDTO {
  kind: 'store'
  store: SourceDTO
  totalMs: number
  recentMs: number // últimas 2 semanas
}

export type UninstallPreviewDTO =
  | { allowed: true; folder: string; bytes: number; files: number }
  | { allowed: false; folder: string; reason: string }

export interface UninstallResultDTO {
  outcome: 'delegated' | 'removed' // delegated = Steam va a pedir su propia confirmación
  library: LibraryDTO
}

export interface LibraryDTO {
  games: GameDTO[]
  errors: { source: SourceDTO; message: string }[]
}

export interface AchievementDTO {
  id: string
  name: string
  description: string | null
  hidden: boolean
  unlocked: boolean
  unlockedAt: number | null
  iconUrl: string | null
  iconLockedUrl: string | null
  globalPercent: number | null
}

export type AchievementsDTO =
  | { status: 'ok'; achievements: AchievementDTO[]; unlocked: number; total: number }
  | { status: 'none' }
  | { status: 'unsupported' }
  | { status: 'not-configured' }
  | { status: 'error'; message: string }

// Estado de la sesión de juego, que Main va avisando:
// starting (lanzado, esperando que arranque) -> running (hub minimizado) -> ended (hub vuelve al frente)
// o not-started (no lo detectamos a tiempo; el hub se queda donde está).
export interface SessionDTO {
  gameId: string
  state: 'starting' | 'running' | 'ended' | 'not-started'
  durationMs: number | null
}

// La key NUNCA vuelve a la UI: solo si está configurada.
export interface SteamKeyStatusDTO {
  configured: boolean
  steamIdFound: boolean
}

// La API que el preload expone como `window.hub`. Es TODO lo que la UI puede hacer.
export interface GameHubApi {
  list(): Promise<LibraryDTO>
  launch(gameId: string): Promise<void>
  addLocal(): Promise<{ library: LibraryDTO; addedId: string } | null> // null = el usuario canceló el diálogo
  removeLocal(gameId: string): Promise<LibraryDTO>
  toggleFullscreen(): Promise<void>
  isFullscreen(): Promise<boolean>
  // Main avisa cada cambio, también cuando lo provoca F11: la UI nunca queda desincronizada.
  onFullscreenChange(listener: (fullscreen: boolean) => void): () => void
  achievements(gameId: string): Promise<AchievementsDTO>
  steamKeyStatus(): Promise<SteamKeyStatusDTO>
  setSteamKey(key: string): Promise<SteamKeyStatusDTO> // valida y verifica antes de guardar
  clearSteamKey(): Promise<SteamKeyStatusDTO>
  openSteamKeyPage(): Promise<void>
  artworkSearch(term: string): Promise<ArtworkCandidateDTO[]>
  artworkApply(gameId: string, candidateId: string): Promise<LibraryDTO>
  artworkPickFile(gameId: string, kind: ArtworkKindDTO): Promise<LibraryDTO | null> // null = canceló
  artworkClear(gameId: string): Promise<LibraryDTO>
  onSessionChange(listener: (session: SessionDTO) => void): () => void
  setManualPlaytime(gameId: string, hours: number): Promise<LibraryDTO>
  renameLocal(gameId: string, title: string): Promise<LibraryDTO>
  openFolder(gameId: string): Promise<void> // por ID: la UI nunca manda una ruta
  uninstallPreview(gameId: string): Promise<UninstallPreviewDTO> // solo juegos locales
  uninstall(gameId: string): Promise<UninstallResultDTO>
  sgdbKeyStatus(): Promise<boolean> // ¿está configurada? La key nunca vuelve a la UI.
  setSgdbKey(key: string): Promise<boolean> // verifica antes de guardar
  openSgdbKeyPage(): Promise<void>
}
