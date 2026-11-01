// PUERTO: una tienda que sabe cuánto jugaste a cada uno de sus juegos.
// Un pedido trae TODA la biblioteca: es más barato que uno por juego.

import type { SourceId } from '../Game.js'
import type { StorePlaytime } from '../Playtime.js'

export interface StorePlaytimeProvider {
  readonly source: SourceId
  // Clave: nativeId (el appid en Steam). Mapa vacío = no configurado o sin datos: NO es un error.
  fetchAll(): Promise<Map<string, StorePlaytime>>
}
