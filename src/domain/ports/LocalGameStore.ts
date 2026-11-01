// PUERTO: dónde se guardan los juegos que agregás a mano.
// Hoy es un JSON en disco. Mañana podría ser SQLite y LocalSource no se entera.

export interface LocalGameRecord {
  id: string
  title: string
  executable: string
  addedAt: string // ISO 8601. Guardamos texto, no Date: JSON no sabe serializar fechas.
  lastPlayed: string | null
  coverPath: string | null
  heroPath?: string | null // opcional: los JSON guardados antes de esta versión no lo tienen
  playtimeMs?: number // LEGADO: la versión anterior guardaba solo el total. Se respeta, pero ya no se escribe.
  sessions?: { startedAt: string; durationMs: number }[] // cada partida medida por el hub
  manualPlaytimeMs?: number // "ya tenía X horas antes de usar el hub"
}

export interface LocalGameStore {
  load(): Promise<LocalGameRecord[]>
  save(records: LocalGameRecord[]): Promise<void>
}
