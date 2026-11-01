// CASO DE USO: seguir una sesión de juego. ¿Arrancó? ¿Terminó? ¿Cuánto duró?
// No sabe CÓMO se detecta un juego corriendo: se lo pregunta a su fuente (puerto GameSource).
//
// Fase 1: esperar a que el juego aparezca (con límite: Steam puede tardar si actualiza).
// Fase 2: esperar a que desaparezca, y medir la duración.

import type { Game } from '../domain/Game.js'
import type { GameSource } from '../domain/ports/GameSource.js'

export interface SessionEvents {
  onStarted: (game: Game) => void | Promise<void>
  onEnded: (game: Game, durationMs: number) => void | Promise<void>
  onNeverStarted: (game: Game) => void | Promise<void>
}

export interface SessionTrackerDeps {
  sources: GameSource[]
  sleep: (ms: number) => Promise<void>
  now: () => number
  pollMs?: number
  startTimeoutMs?: number
}

export class SessionTracker {
  private current: { cancelled: boolean } | null = null

  constructor(private readonly deps: SessionTrackerDeps) {}

  // Si lanzás otro juego mientras uno se sigue, el seguimiento anterior se cancela.
  async track(game: Game, events: SessionEvents): Promise<void> {
    this.cancel()
    const token = { cancelled: false }
    this.current = token

    const source = this.deps.sources.find((s) => s.id === game.source)
    if (!source) return
    const poll = this.deps.pollMs ?? 3000
    const deadline = this.deps.now() + (this.deps.startTimeoutMs ?? 120_000)

    // Fase 1: ¿arrancó?
    while (!(await this.check(source, game, false))) {
      if (token.cancelled) return
      if (this.deps.now() > deadline) {
        await events.onNeverStarted(game)
        return
      }
      await this.deps.sleep(poll)
    }
    if (token.cancelled) return
    const startedAt = this.deps.now()
    await events.onStarted(game)

    // Fase 2: ¿sigue corriendo?
    while (await this.check(source, game, true)) {
      if (token.cancelled) return
      await this.deps.sleep(poll)
    }
    if (token.cancelled) return
    await events.onEnded(game, this.deps.now() - startedAt)
  }

  cancel(): void {
    if (this.current) this.current.cancelled = true
    this.current = null
  }

  // Si la consulta FALLA (ej: PowerShell tardó), no sabemos nada: mantenemos el estado anterior.
  // Así un error puntual no "cierra" una sesión que sigue viva.
  private async check(source: GameSource, game: Game, assumed: boolean): Promise<boolean> {
    try {
      return await source.isRunning(game)
    } catch {
      return assumed
    }
  }
}
