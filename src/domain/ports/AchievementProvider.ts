// PUERTO: quien sabe traer los logros de un juego. Hoy Steam; mañana podría ser RetroAchievements.

import type { Achievement } from '../Achievement.js'
import type { Game } from '../Game.js'

export interface AchievementProvider {
  supports(game: Game): boolean
  // Lista vacía = el juego no tiene logros. Lanza AchievementsNotConfiguredError si falta configurar.
  list(game: Game): Promise<Achievement[]>
}
