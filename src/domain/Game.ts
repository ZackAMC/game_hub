import type { PlaytimeRecord } from './Playtime.js'

// DOMINIO: qué es "un juego" para el hub, venga de donde venga.
// Steam, un .exe suelto, mañana Epic: todos se convierten en esta misma forma.

export type SourceId = 'steam' | 'local'

export interface Game {
  id: string // único en TODO el hub: "<source>:<nativeId>", ej "steam:570"
  source: SourceId
  nativeId: string // el id dentro de su tienda (appid de Steam, uuid de un juego local)
  title: string
  installDir: string
  executable: string | null // solo los juegos locales se lanzan por .exe directo
  sizeBytes: number | null // null = no lo sabemos
  lastPlayed: Date | null
  playtime: PlaytimeRecord | null // null = esta fuente no mide tiempo (Steam lo lleva por su cuenta)
  coverPath: string | null // portada vertical (tipo caja), si existe
  heroPath: string | null // imagen panorámica para el fondo, si existe
}

export function gameId(source: SourceId, nativeId: string): string {
  return `${source}:${nativeId}`
}
