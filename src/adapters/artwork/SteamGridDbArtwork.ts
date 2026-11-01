// ADAPTADOR: imágenes de SteamGridDB, una base comunitaria con arte de CUALQUIER juego
// (incluidos los de consola, que no están en la tienda de Steam).
//   GET /search/autocomplete/{term}  -> juegos que coinciden
//   GET /grids/game/{id}             -> portadas (pedimos 600x900, vertical)
//   GET /heroes/game/{id}            -> fondos panorámicos
// Todas piden "Authorization: Bearer <key>". Las imágenes del CDN no la necesitan.

import type { ArtworkCandidate, ArtworkImages, ArtworkProvider } from '../../domain/ports/ArtworkProvider.js'

const API = 'https://www.steamgriddb.com/api/v2'
const PREFIX = 'sgdb:'
const MAX_RESULTS = 6

export interface SteamGridDbDeps {
  getApiKey: () => Promise<string | null>
  fetchJson: (url: string, headers?: Record<string, string>) => Promise<{ ok: boolean; status: number; body: unknown }>
  fetchImage: (url: string) => Promise<Uint8Array | null>
}

interface SgdbGame {
  id: number
  name: string
  release_date?: number // segundos Unix
}

interface SgdbImage {
  url: string
  thumb?: string
}

// Filtros comunes: solo imágenes estáticas (no animadas) y nada NSFW ni de humor.
const IMAGE_FILTERS = { types: 'static', nsfw: 'false', humor: 'false' }

export class SteamGridDbArtwork implements ArtworkProvider {
  constructor(private readonly deps: SteamGridDbDeps) {}

  supports(candidateId: string): boolean {
    return /^sgdb:\d+$/.test(candidateId)
  }

  async search(term: string): Promise<ArtworkCandidate[]> {
    const key = await this.deps.getApiKey()
    if (!key) return [] // sin key, este proveedor simplemente no aporta resultados

    const res = await this.get(key, `/search/autocomplete/${encodeURIComponent(term)}`)
    const games = parseGames(res).slice(0, MAX_RESULTS)

    // Una miniatura por juego, en paralelo. Si alguna falla, ese resultado queda sin miniatura.
    const thumbs = await Promise.all(
      games.map((g) => this.firstImage(key, 'grids', g.id, { dimensions: '600x900' }).catch(() => null)),
    )
    return games.map((g, i) => ({
      id: `${PREFIX}${g.id}`,
      title: withYear(g),
      thumbUrl: thumbs[i]?.thumb ?? thumbs[i]?.url ?? null,
      sourceLabel: 'SteamGridDB',
    }))
  }

  async download(candidateId: string): Promise<ArtworkImages> {
    if (!this.supports(candidateId)) throw new Error('Resultado inválido')
    const key = await this.deps.getApiKey()
    if (!key) throw new Error('Falta conectar SteamGridDB')
    const gameId = Number(candidateId.slice(PREFIX.length))

    const [grid, hero] = await Promise.all([
      this.firstImage(key, 'grids', gameId, { dimensions: '600x900' }),
      this.firstImage(key, 'heroes', gameId, {}),
    ])
    const [cover, heroBytes] = await Promise.all([
      grid ? this.deps.fetchImage(grid.url) : null,
      hero ? this.deps.fetchImage(hero.url) : null,
    ])
    return { cover, hero: heroBytes }
  }

  // Comprueba la key con una búsqueda mínima antes de guardarla.
  async verifyKey(key: string): Promise<boolean> {
    return (await this.get(key, '/search/autocomplete/portal')).ok
  }

  // SteamGridDB ordena por votos de la comunidad: el primero suele ser el mejor.
  private async firstImage(key: string, kind: 'grids' | 'heroes', gameId: number, extra: Record<string, string>) {
    const params = new URLSearchParams({ ...IMAGE_FILTERS, ...extra })
    const res = await this.get(key, `/${kind}/game/${gameId}?${params.toString()}`)
    return parseImages(res)[0] ?? null
  }

  private async get(key: string, path: string) {
    const res = await this.deps.fetchJson(`${API}${path}`, { Authorization: `Bearer ${key}` })
    if (res.status === 401) throw new Error('La API key de SteamGridDB no es válida')
    return res
  }
}

// PURAS: respuesta -> datos. Toleran respuestas incompletas.
export function parseGames(res: { ok: boolean; body: unknown }): SgdbGame[] {
  const data = (res.body as { data?: unknown } | null)?.data
  if (!res.ok || !Array.isArray(data)) return []
  return data.filter((g): g is SgdbGame => typeof g?.id === 'number' && typeof g?.name === 'string')
}

export function parseImages(res: { ok: boolean; body: unknown }): SgdbImage[] {
  const data = (res.body as { data?: unknown } | null)?.data
  if (!res.ok || !Array.isArray(data)) return []
  return data.filter((img): img is SgdbImage => typeof img?.url === 'string')
}

// "God of War III (2010)": el año ayuda a distinguir remakes y remasters.
function withYear(game: SgdbGame): string {
  if (!game.release_date) return game.name
  return `${game.name} (${new Date(game.release_date * 1000).getUTCFullYear()})`
}
