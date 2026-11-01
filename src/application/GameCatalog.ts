// CASO DE USO: la biblioteca unificada. Junta todas las fuentes y sabe a cuál pedirle cada cosa.
// No conoce Steam ni archivos .exe: solo habla con el puerto GameSource.

import type { Game, SourceId } from '../domain/Game.js'
import type { GameSource, UninstallOutcome } from '../domain/ports/GameSource.js'

export interface SourceError {
  source: SourceId
  message: string
}

export interface CatalogSnapshot {
  games: Game[]
  errors: SourceError[] // si Steam falla, los juegos locales se siguen mostrando
}

export class GameCatalog {
  private games = new Map<string, Game>()

  constructor(private readonly sources: GameSource[]) {}

  async refresh(): Promise<CatalogSnapshot> {
    // allSettled: una fuente rota NO tumba a las demás.
    const results = await Promise.allSettled(this.sources.map((s) => s.list()))

    const games: Game[] = []
    const errors: SourceError[] = []
    results.forEach((result, i) => {
      const source = this.sources[i]!
      if (result.status === 'fulfilled') games.push(...result.value)
      else errors.push({ source: source.id, message: describe(result.reason) })
    })

    games.sort(byRecentThenTitle)
    this.games = new Map(games.map((g) => [g.id, g]))
    return { games, errors }
  }

  get(id: string): Game | undefined {
    return this.games.get(id)
  }

  async launch(id: string): Promise<void> {
    const { game, source } = this.resolve(id)
    await source.launch(game)
  }

  async uninstall(id: string): Promise<UninstallOutcome> {
    const { game, source } = this.resolve(id)
    return source.uninstall(game)
  }

  private resolve(id: string): { game: Game; source: GameSource } {
    const game = this.games.get(id)
    if (!game) throw new Error('Ese juego no está en la biblioteca')
    const source = this.sources.find((s) => s.id === game.source)
    if (!source) throw new Error(`No hay una fuente registrada para "${game.source}"`)
    return { game, source }
  }
}

// Primero lo jugado más recientemente; lo nunca jugado va al final, en orden alfabético.
function byRecentThenTitle(a: Game, b: Game): number {
  const ta = a.lastPlayed?.getTime() ?? 0
  const tb = b.lastPlayed?.getTime() ?? 0
  if (ta !== tb) return tb - ta
  return a.title.localeCompare(b.title, 'es')
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
