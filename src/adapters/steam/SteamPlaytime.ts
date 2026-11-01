// ADAPTADOR: implementa StorePlaytimeProvider con IPlayerService/GetOwnedGames.
// Un solo pedido devuelve las horas de TODOS tus juegos (instalados o no).

import type { StorePlaytime } from '../../domain/Playtime.js'
import type { StorePlaytimeProvider } from '../../domain/ports/StorePlaytimeProvider.js'
import type { HttpResult } from './SteamAchievements.js'
import { readPath, steamApiUrl } from './webApi.js'

export interface SteamPlaytimeDeps {
  getApiKey: () => Promise<string | null>
  getSteamId: () => Promise<string | null>
  fetchJson: (url: string) => Promise<HttpResult>
}

export interface OwnedGame {
  appid: number
  playtime_forever?: number // minutos
  playtime_2weeks?: number // minutos; Steam lo omite si no jugaste en 2 semanas
}

export class SteamPlaytime implements StorePlaytimeProvider {
  readonly source = 'steam' as const

  constructor(private readonly deps: SteamPlaytimeDeps) {}

  async fetchAll(): Promise<Map<string, StorePlaytime>> {
    const key = await this.deps.getApiKey()
    const steamId = await this.deps.getSteamId()
    if (!key || !steamId) return new Map() // sin key no hay horas: no es un error, es "no configurado"

    const res = await this.deps.fetchJson(
      steamApiUrl('IPlayerService/GetOwnedGames/v1', { key, steamid: steamId, include_played_free_games: '1' }),
    )
    if (!res.ok) throw new Error(`Steam respondió con un error (${res.status})`)
    // Perfil privado: Steam responde 200 con { response: {} }. Lo tratamos como "sin datos".
    return parseOwnedGames(readPath<OwnedGame[]>(res.body, ['response', 'games']) ?? [])
  }
}

// PURA: minutos de Steam -> modelo del dominio. Ignora los juegos que nunca abriste.
export function parseOwnedGames(games: OwnedGame[]): Map<string, StorePlaytime> {
  const result = new Map<string, StorePlaytime>()
  for (const g of games) {
    const total = g.playtime_forever ?? 0
    if (!Number.isInteger(g.appid) || total <= 0) continue
    result.set(String(g.appid), { totalMs: total * 60_000, recentMs: (g.playtime_2weeks ?? 0) * 60_000 })
  }
  return result
}
