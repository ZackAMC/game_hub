// ADAPTADOR: busca imágenes en la tienda de Steam. No necesita API key.
//   Búsqueda: store.steampowered.com/api/storesearch  -> nombre + appid
//   Imágenes: servidores de Steam, con rutas predecibles a partir del appid

import type { ArtworkCandidate, ArtworkImages, ArtworkProvider } from '../../domain/ports/ArtworkProvider.js'

const SEARCH = 'https://store.steampowered.com/api/storesearch/'
const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps'
const PREFIX = 'steam:'
const MAX_RESULTS = 8

export interface SteamStoreDeps {
  fetchJson: (url: string) => Promise<{ ok: boolean; body: unknown }>
  fetchImage: (url: string) => Promise<Uint8Array | null> // null si no existe o no es imagen
}

interface SearchItem {
  type?: string
  id?: number
  name?: string
}

export class SteamStoreArtwork implements ArtworkProvider {
  constructor(private readonly deps: SteamStoreDeps) {}

  supports(candidateId: string): boolean {
    return /^steam:\d+$/.test(candidateId)
  }

  async search(term: string): Promise<ArtworkCandidate[]> {
    const params = new URLSearchParams({ term, l: 'spanish', cc: 'US' })
    const res = await this.deps.fetchJson(`${SEARCH}?${params.toString()}`)
    if (!res.ok) throw new Error('La búsqueda en Steam no respondió')
    return parseSearch(res.body)
  }

  async download(candidateId: string): Promise<ArtworkImages> {
    if (!this.supports(candidateId)) throw new Error('Resultado inválido')
    const appid = candidateId.slice(PREFIX.length)

    const [cover, hero] = await Promise.all([
      // Si no hay portada vertical, el "header" horizontal es mejor que nada.
      this.firstAvailable([artUrl(appid, 'library_600x900_2x.jpg'), artUrl(appid, 'library_600x900.jpg'), artUrl(appid, 'header.jpg')]),
      this.firstAvailable([artUrl(appid, 'library_hero.jpg')]),
    ])
    return { cover, hero }
  }

  private async firstAvailable(urls: string[]): Promise<Uint8Array | null> {
    for (const url of urls) {
      const bytes = await this.deps.fetchImage(url)
      if (bytes) return bytes
    }
    return null
  }
}

// PURA: respuesta de Steam -> candidatos. Solo "app" (juegos), nada de bundles ni paquetes.
export function parseSearch(body: unknown): ArtworkCandidate[] {
  const items = (body as { items?: SearchItem[] } | null)?.items
  if (!Array.isArray(items)) return []
  return items
    .filter((it) => it.type === 'app' && typeof it.id === 'number' && typeof it.name === 'string')
    .slice(0, MAX_RESULTS)
    .map((it) => ({
      id: `${PREFIX}${it.id}`,
      title: it.name!,
      thumbUrl: artUrl(String(it.id), 'library_600x900.jpg'),
      sourceLabel: 'Steam',
    }))
}

function artUrl(appid: string, file: string): string {
  return `${CDN}/${appid}/${file}`
}
