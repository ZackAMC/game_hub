// ADAPTADOR: juegos que agregás a mano (un .exe en cualquier carpeta).
// A diferencia de Steam, acá NOSOTROS somos la fuente de verdad: guardamos la lista en un LocalGameStore.

import { basename, dirname, extname } from 'node:path'
import { gameId, type Game } from '../../domain/Game.js'
import type { GameSource, UninstallOutcome } from '../../domain/ports/GameSource.js'
import { checkUninstallFolder } from '../../domain/UninstallGuard.js'
import type { LocalGameRecord, LocalGameStore } from '../../domain/ports/LocalGameStore.js'

// Todo lo que toca el sistema operativo entra por acá. En los tests, son fakes.
export interface LocalSourceDeps {
  store: LocalGameStore
  spawnGame: (executable: string) => Promise<void>
  // ¿Hay algún proceso corriendo desde esta carpeta, o con el nombre de este .exe?
  isProcessRunning: (folder: string, exeName: string) => Promise<boolean>
  fileExists: (path: string) => Promise<boolean>
  newId: () => string
  now?: () => Date
  // Para desinstalar:
  trash: (path: string) => Promise<void> // mandar a la Papelera
  folderStats: (path: string) => Promise<{ bytes: number; files: number }>
  userHome: string
}

export type UninstallPreview =
  | { allowed: true; folder: string; bytes: number; files: number }
  | { allowed: false; folder: string; reason: string }

export class LocalSource implements GameSource {
  readonly id = 'local' as const

  constructor(private readonly deps: LocalSourceDeps) {}

  async list(): Promise<Game[]> {
    return (await this.deps.store.load()).map(toGame)
  }

  async launch(game: Game): Promise<void> {
    if (!game.executable) throw new Error('Este juego no tiene ejecutable')
    if (!(await this.deps.fileExists(game.executable))) {
      throw new Error(`El ejecutable ya no existe: ${game.executable}`)
    }
    await this.deps.spawnGame(game.executable)
    await this.update(game.nativeId, (r) => ({ ...r, lastPlayed: this.now().toISOString() }))
  }

  // No miramos solo el proceso que lanzamos: muchos .exe son LANZADORES que abren el juego real
  // y se cierran. Por eso preguntamos por CUALQUIER proceso que corra desde la carpeta del juego.
  async isRunning(game: Game): Promise<boolean> {
    if (!game.executable) return false
    return this.deps.isProcessRunning(game.installDir, basename(game.executable, extname(game.executable)))
  }

  // Guarda la sesión COMPLETA (cuándo empezó y cuánto duró), no solo la suma.
  async recordSession(nativeId: string, startedAt: Date, durationMs: number): Promise<void> {
    await this.update(nativeId, (r) => ({
      ...r,
      sessions: [...(r.sessions ?? []), { startedAt: startedAt.toISOString(), durationMs: Math.max(0, durationMs) }],
      lastPlayed: this.now().toISOString(),
    }))
  }

  async setManualPlaytime(nativeId: string, ms: number): Promise<void> {
    if (!Number.isFinite(ms) || ms < 0) throw new Error('Tiempo inválido')
    await this.update(nativeId, (r) => ({ ...r, manualPlaytimeMs: Math.round(ms) }))
  }

  async add(executable: string, title?: string): Promise<LocalGameRecord> {
    if (extname(executable).toLowerCase() !== '.exe') throw new Error('Elegí un archivo .exe')
    if (!(await this.deps.fileExists(executable))) throw new Error('Ese archivo no existe')

    const records = await this.deps.store.load()
    // Windows no distingue mayúsculas en las rutas: "C:\Juego.exe" y "c:\juego.exe" son el mismo.
    if (records.some((r) => r.executable.toLowerCase() === executable.toLowerCase())) {
      throw new Error('Ese juego ya está en la biblioteca')
    }

    const record: LocalGameRecord = {
      id: this.deps.newId(),
      title: title?.trim() || guessTitle(executable),
      executable,
      addedAt: this.now().toISOString(),
      lastPlayed: null,
      coverPath: null,
      heroPath: null,
    }
    await this.deps.store.save([...records, record])
    return record
  }

  async setArtwork(nativeId: string, patch: { coverPath?: string | null; heroPath?: string | null }): Promise<void> {
    await this.update(nativeId, (r) => ({ ...r, ...patch }))
  }

  // Qué se borraría, ANTES de borrar: carpeta, tamaño y si la regla de seguridad lo permite.
  async previewUninstall(game: Game): Promise<UninstallPreview> {
    const folder = game.installDir
    const guard = await this.guard(game)
    if (!guard.allowed) return { allowed: false, folder, reason: guard.reason }
    const stats = await this.deps.folderStats(folder)
    return { allowed: true, folder, ...stats }
  }

  async uninstall(game: Game): Promise<UninstallOutcome> {
    // La regla se vuelve a aplicar ACÁ: no importa qué haya mostrado (o salteado) la UI.
    const guard = await this.guard(game)
    if (!guard.allowed) throw new Error(`No se puede desinstalar: ${guard.reason}`)
    await this.deps.trash(game.installDir)
    await this.remove(game.nativeId)
    return 'removed'
  }

  private async guard(game: Game) {
    const others = (await this.deps.store.load()).filter((r) => r.id !== game.nativeId).map((r) => dirname(r.executable))
    return checkUninstallFolder(game.installDir, others, this.deps.userHome)
  }

  // Quitar de la BIBLIOTECA (no borra archivos del disco).
  async remove(nativeId: string): Promise<void> {
    const records = await this.deps.store.load()
    await this.deps.store.save(records.filter((r) => r.id !== nativeId))
  }

  private async update(nativeId: string, change: (r: LocalGameRecord) => LocalGameRecord): Promise<void> {
    const records = await this.deps.store.load()
    await this.deps.store.save(records.map((r) => (r.id === nativeId ? change(r) : r)))
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }
}

// "F:\Juegos\Hollow Knight\hollow_knight.exe" -> "Hollow Knight". El nombre de la carpeta suele ser mejor que el del .exe.
export function guessTitle(executable: string): string {
  const folder = basename(dirname(executable))
  const isDriveRoot = /^[a-z]:\\?$/i.test(dirname(executable))
  const raw = folder && !isDriveRoot ? folder : basename(executable, extname(executable))
  return raw.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function toGame(r: LocalGameRecord): Game {
  return {
    id: gameId('local', r.id),
    source: 'local',
    nativeId: r.id,
    title: r.title,
    installDir: dirname(r.executable),
    executable: r.executable,
    sizeBytes: null,
    lastPlayed: r.lastPlayed ? new Date(r.lastPlayed) : null,
    playtime: {
      sessions: (r.sessions ?? []).map((s) => ({ startedAt: new Date(s.startedAt), durationMs: s.durationMs })),
      manualMs: r.manualPlaytimeMs ?? 0,
      legacyMs: r.playtimeMs ?? 0,
    },
    coverPath: r.coverPath,
    heroPath: r.heroPath ?? null,
  }
}
