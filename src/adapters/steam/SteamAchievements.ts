// ADAPTADOR: implementa AchievementProvider con la Steam Web API.
//
// Hace 3 pedidos en paralelo por juego:
//   GetSchemaForGame        -> qué logros existen (nombre, descripción, íconos, si es oculto)
//   GetPlayerAchievements   -> cuáles tenés vos y cuándo los desbloqueaste
//   GetGlobalAchievement... -> % de jugadores que tiene cada uno (rareza). No necesita key.

import { AchievementsNotConfiguredError, type Achievement } from '../../domain/Achievement.js'
import type { Game } from '../../domain/Game.js'
import type { AchievementProvider } from '../../domain/ports/AchievementProvider.js'
import { readPath, steamApiUrl as url } from './webApi.js'

const API_KEY = /^[0-9A-F]{32}$/i

export interface HttpResult {
  ok: boolean
  status: number
  body: unknown
}

export interface SteamAchievementsDeps {
  getApiKey: () => Promise<string | null>
  getSteamId: () => Promise<string | null>
  fetchJson: (url: string) => Promise<HttpResult> // inyectado: en los tests es un fake, sin red
  language?: string
}

// --- Formas de las respuestas de Steam (solo los campos que usamos) ---

export interface SchemaAchievement {
  name: string
  displayName?: string
  description?: string
  hidden?: number
  icon?: string
  icongray?: string
}
export interface PlayerAchievement {
  apiname: string
  achieved: number
  unlocktime: number
}
export interface GlobalAchievement {
  name: string
  percent: number | string // Steam lo manda a veces como número y a veces como texto
}

export function isValidApiKeyFormat(key: string): boolean {
  return API_KEY.test(key)
}

export class SteamAchievements implements AchievementProvider {
  constructor(private readonly deps: SteamAchievementsDeps) {}

  supports(game: Game): boolean {
    return game.source === 'steam'
  }

  async list(game: Game): Promise<Achievement[]> {
    const key = await this.deps.getApiKey()
    if (!key) throw new AchievementsNotConfiguredError()
    const steamId = await this.deps.getSteamId()
    if (!steamId) throw new Error('No encontré tu cuenta de Steam en esta PC')

    const appid = game.nativeId
    const l = this.deps.language ?? 'spanish'
    const [schema, player, global] = await Promise.all([
      this.deps.fetchJson(url('ISteamUserStats/GetSchemaForGame/v2', { key, appid, l })),
      this.deps.fetchJson(url('ISteamUserStats/GetPlayerAchievements/v1', { key, steamid: steamId, appid })),
      // La rareza es un "extra": si falla, mostramos los logros igual.
      this.deps.fetchJson(url('ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2', { gameid: appid })).catch(() => null),
    ])

    if (schema.status === 401 || schema.status === 403) throw new Error('La API key de Steam no es válida')
    const definitions = readPath<SchemaAchievement[]>(schema.body, ['game', 'availableGameStats', 'achievements']) ?? []
    if (definitions.length === 0) return [] // el juego no tiene logros

    if (!player.ok) {
      const error = readPath<string>(player.body, ['playerstats', 'error']) ?? ''
      if (/not public/i.test(error)) {
        throw new Error('Tu perfil de Steam es privado. En Steam: Perfil → Editar perfil → Privacidad → "Detalles de juego: Público".')
      }
      if (/no stats/i.test(error)) return []
      throw new Error(`Steam respondió con un error (${player.status})`)
    }

    return mergeAchievements(
      definitions,
      readPath<PlayerAchievement[]>(player.body, ['playerstats', 'achievements']) ?? [],
      readPath<GlobalAchievement[]>(global?.body, ['achievementpercentages', 'achievements']) ?? [],
    )
  }

  // Comprueba la key con un pedido barato antes de guardarla.
  async verifyKey(key: string, steamId: string): Promise<boolean> {
    const res = await this.deps.fetchJson(url('ISteamUser/GetPlayerSummaries/v2', { key, steamids: steamId }))
    return res.ok
  }
}

// PURA: junta las tres respuestas en el modelo del dominio. Es lo que más se testea.
export function mergeAchievements(
  schema: SchemaAchievement[],
  player: PlayerAchievement[],
  global: GlobalAchievement[],
): Achievement[] {
  const progress = new Map(player.map((p) => [p.apiname, p]))
  const rarity = new Map(global.map((g) => [g.name, Number(g.percent)]))

  return schema.map((def) => {
    const mine = progress.get(def.name)
    const unlocked = mine?.achieved === 1
    const percent = rarity.get(def.name)
    return {
      id: def.name,
      name: def.displayName ?? def.name,
      description: def.description?.trim() || null,
      hidden: def.hidden === 1,
      unlocked,
      unlockedAt: unlocked && mine.unlocktime > 0 ? new Date(mine.unlocktime * 1000) : null,
      iconUrl: def.icon ?? null,
      iconLockedUrl: def.icongray ?? null,
      globalPercent: percent !== undefined && Number.isFinite(percent) ? percent : null,
    }
  })
}
