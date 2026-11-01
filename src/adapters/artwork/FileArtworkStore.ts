// ADAPTADOR: guarda las imágenes en una carpeta propia de la app (userData/artwork).

import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import type { ArtworkKind, ArtworkStore } from '../../domain/ports/ArtworkStore.js'

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export class FileArtworkStore implements ArtworkStore {
  private readonly dir: string

  constructor(dir: string) {
    this.dir = resolve(dir)
  }

  async saveBytes(gameKey: string, kind: ArtworkKind, bytes: Uint8Array): Promise<string> {
    const path = await this.newPath(gameKey, kind, '.jpg')
    await writeFile(path, bytes)
    return path
  }

  async copyFile(gameKey: string, kind: ArtworkKind, sourcePath: string): Promise<string> {
    const ext = extname(sourcePath).toLowerCase()
    if (!ALLOWED.has(ext)) throw new Error('Elegí una imagen JPG, PNG o WEBP')
    const path = await this.newPath(gameKey, kind, ext)
    await copyFile(sourcePath, path) // copiamos: si después movés o borrás el original, no se rompe
    return path
  }

  async removeOwned(path: string): Promise<void> {
    // Defensa: SOLO borramos dentro de nuestra carpeta. Si por un bug nos pasaran
    // la ruta de una imagen del usuario, no la tocamos.
    if (!resolve(path).startsWith(this.dir + sep)) return
    await rm(path, { force: true })
  }

  // Nombre nuevo en cada guardado: así la UI nunca muestra una imagen vieja que quedó en caché.
  private async newPath(gameKey: string, kind: ArtworkKind, ext: string): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    const safeKey = gameKey.replace(/[^a-z0-9-]/gi, '_')
    return join(this.dir, `${safeKey}-${kind}-${Date.now()}${ext}`)
  }
}
