// PUERTO: dónde se GUARDAN las imágenes. Siempre en disco local: así la app funciona sin internet
// y las imágenes no dependen de que el archivo original siga en su lugar.

export type ArtworkKind = 'cover' | 'hero'

export interface ArtworkStore {
  saveBytes(gameKey: string, kind: ArtworkKind, bytes: Uint8Array): Promise<string> // devuelve la ruta
  copyFile(gameKey: string, kind: ArtworkKind, sourcePath: string): Promise<string>
  // Borra SOLO si el archivo es nuestro: nunca toca una imagen fuera de la carpeta del store.
  removeOwned(path: string): Promise<void>
}
