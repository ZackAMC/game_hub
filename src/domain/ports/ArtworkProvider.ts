// PUERTO: quien sabe BUSCAR y DESCARGAR imágenes de juegos. Hoy la tienda de Steam; mañana SteamGridDB.

export interface ArtworkCandidate {
  id: string // "<proveedor>:<id>", ej "steam:367520"
  title: string
  thumbUrl: string | null // miniatura para que el usuario elija el correcto
  sourceLabel: string // "Steam", "SteamGridDB": para que sepas de dónde viene cada resultado
}

export interface ArtworkImages {
  cover: Uint8Array | null // portada vertical
  hero: Uint8Array | null // fondo panorámico
}

export interface ArtworkProvider {
  supports(candidateId: string): boolean
  search(term: string): Promise<ArtworkCandidate[]>
  download(candidateId: string): Promise<ArtworkImages>
}
