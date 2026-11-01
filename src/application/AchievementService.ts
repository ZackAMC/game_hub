// CASO DE USO: "mostrame los logros de este juego".
// Elige el proveedor correcto, traduce los errores a estados que la UI entiende y cachea,
// para no pegarle a la API cada vez que pasás por arriba de un juego.

import { AchievementsNotConfiguredError, sortAchievements, type Achievement } from '../domain/Achievement.js'
import type { Game } from '../domain/Game.js'
import type { AchievementProvider } from '../domain/ports/AchievementProvider.js'

export type AchievementResult =
  | { status: 'ok'; achievements: Achievement[]; unlocked: number; total: number }
  | { status: 'none' } // el juego no tiene logros
  | { status: 'unsupported' } // la fuente no tiene sistema de logros (juegos locales)
  | { status: 'not-configured' }
  | { status: 'error'; message: string }

const TTL_MS = 5 * 60_000

export class AchievementService {
  private cache = new Map<string, { at: number; result: AchievementResult }>()

  constructor(
    private readonly findGame: (id: string) => Game | undefined,
    private readonly providers: AchievementProvider[],
    private readonly now: () => number = Date.now,
  ) {}

  async get(gameId: string): Promise<AchievementResult> {
    const game = this.findGame(gameId)
    if (!game) return { status: 'error', message: 'Ese juego no está en la biblioteca' }

    const provider = this.providers.find((p) => p.supports(game))
    if (!provider) return { status: 'unsupported' }

    const cached = this.cache.get(gameId)
    if (cached && this.now() - cached.at < TTL_MS) return cached.result

    const result = await this.fetch(provider, game)
    // Solo se cachean los resultados "buenos": un error de red se reintenta la próxima vez.
    if (result.status === 'ok' || result.status === 'none') this.cache.set(gameId, { at: this.now(), result })
    return result
  }

  // Al cambiar la API key, lo cacheado ya no vale.
  invalidate(): void {
    this.cache.clear()
  }

  private async fetch(provider: AchievementProvider, game: Game): Promise<AchievementResult> {
    try {
      const list = await provider.list(game)
      if (list.length === 0) return { status: 'none' }
      const achievements = sortAchievements(list)
      return {
        status: 'ok',
        achievements,
        unlocked: achievements.filter((a) => a.unlocked).length,
        total: achievements.length,
      }
    } catch (err) {
      if (err instanceof AchievementsNotConfiguredError) return { status: 'not-configured' }
      return { status: 'error', message: err instanceof Error ? err.message : String(err) }
    }
  }
}
