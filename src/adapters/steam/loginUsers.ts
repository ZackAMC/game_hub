// config/loginusers.vdf -> el SteamID64 de la cuenta con la que usás Steam en esta PC.
// Así no te pedimos un dato más: Steam ya lo sabe.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { findSteamPath } from './steamPath.js'
import { getObject, getString, parseVdf } from './vdf.js'

const STEAM_ID64 = /^7656\d{13}$/

// Pura: elige la cuenta marcada como "MostRecent"; si no hay marca, la del login más reciente.
export function pickSteamId(text: string): string | null {
  const users = getObject(parseVdf(text), 'users')
  if (!users) return null

  const candidates = Object.entries(users)
    .filter(([id, data]) => STEAM_ID64.test(id) && typeof data === 'object')
    .map(([id, data]) => ({
      id,
      mostRecent: getString(data as never, 'MostRecent') === '1',
      timestamp: Number(getString(data as never, 'Timestamp') ?? 0),
    }))

  const recent = candidates.find((c) => c.mostRecent)
  if (recent) return recent.id
  candidates.sort((a, b) => b.timestamp - a.timestamp)
  return candidates[0]?.id ?? null
}

export async function detectSteamId(): Promise<string | null> {
  const steamPath = await findSteamPath()
  if (!steamPath) return null
  try {
    return pickSteamId(await readFile(join(steamPath, 'config', 'loginusers.vdf'), 'utf8'))
  } catch {
    return null
  }
}
