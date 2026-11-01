// PUERTO: el contrato que cumple CADA tienda o fuente de juegos.
// Esta interfaz es la que hace escalable al hub: sumar Epic, GOG o lo que sea
// es escribir un adaptador nuevo que la implemente. Nada más cambia.

import type { Game, SourceId } from '../Game.js'

// "delegated": la tienda se encarga y pide su propia confirmación (Steam).
// "removed": ya se desinstaló (los archivos están en la Papelera).
export type UninstallOutcome = 'delegated' | 'removed'

export interface GameSource {
  readonly id: SourceId
  list(): Promise<Game[]>
  launch(game: Game): Promise<void>
  // ¿Está corriendo AHORA? Cada fuente lo sabe a su manera (Steam: registro; locales: procesos).
  isRunning(game: Game): Promise<boolean>
  uninstall(game: Game): Promise<UninstallOutcome>
}
