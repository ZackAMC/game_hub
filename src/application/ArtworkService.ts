// CASO DE USO: poner imágenes a un juego local.
// Busca en los proveedores, descarga lo elegido, lo guarda en disco y actualiza el juego.
// Se encarga también de borrar la imagen VIEJA, para que la carpeta no acumule basura.

import type { Game } from '../domain/Game.js'
import type { ArtworkCandidate, ArtworkProvider } from '../domain/ports/ArtworkProvider.js'
import type { ArtworkKind, ArtworkStore } from '../domain/ports/ArtworkStore.js'

export type ArtworkPatch = { coverPath?: string | null; heroPath?: string | null }

export interface ArtworkServiceDeps {
  findGame: (id: string) => Game | undefined
  providers: ArtworkProvider[]
  store: ArtworkStore
  setArtwork: (nativeId: string, patch: ArtworkPatch) => Promise<void> // lo implementa LocalSource
}

export class ArtworkService {
  constructor(private readonly deps: ArtworkServiceDeps) {}

  async search(term: string): Promise<ArtworkCandidate[]> {
    const clean = cleanSearchTerm(term)
    if (!clean) return []
    // Un proveedor caído no debería dejarte sin resultados de los demás.
    const results = await Promise.allSettled(this.deps.providers.map((p) => p.search(clean)))
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  }

  async applyCandidate(gameId: string, candidateId: string): Promise<void> {
    const game = this.localGame(gameId)
    const provider = this.deps.providers.find((p) => p.supports(candidateId))
    if (!provider) throw new Error('Resultado inválido')

    const images = await provider.download(candidateId)
    if (!images.cover && !images.hero) throw new Error('Ese resultado no tiene imágenes disponibles')

    const key = game.nativeId
    await this.replace(game, {
      coverPath: images.cover ? await this.deps.store.saveBytes(key, 'cover', images.cover) : game.coverPath,
      heroPath: images.hero ? await this.deps.store.saveBytes(key, 'hero', images.hero) : game.heroPath,
    })
  }

  async applyFile(gameId: string, kind: ArtworkKind, sourcePath: string): Promise<void> {
    const game = this.localGame(gameId)
    const saved = await this.deps.store.copyFile(game.nativeId, kind, sourcePath)
    await this.replace(game, kind === 'cover' ? { coverPath: saved } : { heroPath: saved })
  }

  async clear(gameId: string): Promise<void> {
    const game = this.localGame(gameId)
    await this.replace(game, { coverPath: null, heroPath: null })
  }

  private localGame(gameId: string): Game {
    const game = this.deps.findGame(gameId)
    if (!game) throw new Error('Ese juego no está en la biblioteca')
    // Las imágenes de Steam las maneja Steam: solo editamos las de juegos locales.
    if (game.source !== 'local') throw new Error('Solo se pueden cambiar las imágenes de juegos locales')
    return game
  }

  // Primero se guarda lo nuevo y DESPUÉS se borra lo viejo: si algo falla, nunca quedás sin imagen.
  private async replace(game: Game, patch: ArtworkPatch): Promise<void> {
    await this.deps.setArtwork(game.nativeId, patch)
    for (const [field, previous] of [
      ['coverPath', game.coverPath],
      ['heroPath', game.heroPath],
    ] as const) {
      const next = patch[field]
      if (next !== undefined && previous && previous !== next) await this.deps.store.removeOwned(previous)
    }
  }
}

// "Hollow_Knight [v1.5.78] (Repack)" -> "Hollow Knight". Las búsquedas por nombre fallan con ruido.
export function cleanSearchTerm(raw: string): string {
  return raw
    .replace(/[[(].*?[\])]/g, ' ') // todo lo que esté entre [] o ()
    // Versiones ANTES de tocar los puntos: si no, "v1.4.0" se vuelve "v1 4 0" y ya no se reconoce.
    .replace(/\bv?\d+(\.\d+){1,3}[a-z]?\b/gi, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\b(repack|portable|goty|deluxe edition|build \d+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
