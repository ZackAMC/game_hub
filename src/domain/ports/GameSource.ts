// PUERTO: el contrato que cumple CADA tienda o fuente de juegos.
// Esta interfaz es la que hace escalable al hub: sumar Epic, GOG o lo que sea
// es escribir un adaptador nuevo que la implemente. Nada más cambia.

import type { Game, SourceId } from '../Game.js'

export interface GameSource {
  readonly id: SourceId
  list(): Promise<Game[]>
  launch(game: Game): Promise<void>
  // ¿Está corriendo AHORA? Cada fuente lo sabe a su manera (Steam: registro; locales: procesos).
  isRunning(game: Game): Promise<boolean>
}
