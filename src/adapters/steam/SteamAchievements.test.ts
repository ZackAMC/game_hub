import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AchievementsNotConfiguredError } from '../../domain/Achievement.js'
import type { Game } from '../../domain/Game.js'
import { pickSteamId } from './loginUsers.js'
import { isValidApiKeyFormat, mergeAchievements, SteamAchievements, type HttpResult } from './SteamAchievements.js'

const game: Game = {
  id: 'steam:250900',
  source: 'steam',
  nativeId: '250900',
  title: 'Isaac',
  installDir: 'X:\\',
  executable: null,
  sizeBytes: null,
  lastPlayed: null,
  playtime: null,
  coverPath: null,
  heroPath: null,
}
const KEY = '0123456789ABCDEF0123456789ABCDEF'

// Respuestas falsas según el endpoint pedido.
function provider(responses: Record<string, HttpResult>, key: string | null = KEY) {
  const requested: string[] = []
  const steam = new SteamAchievements({
    getApiKey: async () => key,
    getSteamId: async () => '76561198000000000',
    fetchJson: async (u) => {
      requested.push(u)
      const match = Object.keys(responses).find((k) => u.includes(k))
      return match ? responses[match]! : { ok: false, status: 404, body: null }
    },
  })
  return { steam, requested }
}

const SCHEMA: HttpResult = {
  ok: true,
  status: 200,
  body: {
    game: {
      availableGameStats: {
        achievements: [
          { name: 'A', displayName: 'Primer paso', description: 'Ganá una vez', hidden: 0, icon: 'a.jpg', icongray: 'a-g.jpg' },
          { name: 'B', displayName: 'Secreto', hidden: 1 },
        ],
      },
    },
  },
}

test('mergeAchievements combina definición, progreso y rareza', () => {
  const [a, b] = mergeAchievements(
    [
      { name: 'A', displayName: 'Primer paso', description: ' Ganá una vez ', icon: 'a.jpg' },
      { name: 'B', hidden: 1 },
    ],
    [
      { apiname: 'A', achieved: 1, unlocktime: 1700000000 },
      { apiname: 'B', achieved: 0, unlocktime: 0 },
    ],
    [
      { name: 'A', percent: '45.5' },
      { name: 'B', percent: 1.2 },
    ],
  )
  assert.equal(a?.name, 'Primer paso')
  assert.equal(a?.description, 'Ganá una vez')
  assert.equal(a?.unlocked, true)
  assert.equal(a?.unlockedAt?.getTime(), 1700000000 * 1000)
  assert.equal(a?.globalPercent, 45.5) // el texto "45.5" se convirtió a número
  assert.equal(b?.name, 'B') // sin displayName, usa el id
  assert.equal(b?.hidden, true)
  assert.equal(b?.unlocked, false)
  assert.equal(b?.unlockedAt, null)
})

test('sin API key lanza AchievementsNotConfiguredError y no hace pedidos', async () => {
  const { steam, requested } = provider({}, null)
  await assert.rejects(steam.list(game), AchievementsNotConfiguredError)
  assert.equal(requested.length, 0)
})

test('perfil privado da un mensaje que explica cómo arreglarlo', async () => {
  const { steam } = provider({
    GetSchemaForGame: SCHEMA,
    GetPlayerAchievements: { ok: false, status: 403, body: { playerstats: { error: 'Profile is not public', success: false } } },
  })
  await assert.rejects(steam.list(game), /Detalles de juego: Público/)
})

test('juego sin logros devuelve lista vacía', async () => {
  const { steam } = provider({
    GetSchemaForGame: { ok: true, status: 200, body: { game: {} } },
    GetPlayerAchievements: { ok: false, status: 400, body: { playerstats: { error: 'Requested app has no stats' } } },
  })
  assert.deepEqual(await steam.list(game), [])
})

test('si la rareza falla, los logros se muestran igual', async () => {
  const { steam } = provider({
    GetSchemaForGame: SCHEMA,
    GetPlayerAchievements: { ok: true, status: 200, body: { playerstats: { achievements: [{ apiname: 'A', achieved: 1, unlocktime: 5 }] } } },
  })
  const list = await steam.list(game)
  assert.equal(list.length, 2)
  assert.equal(list[0]?.globalPercent, null)
})

test('la key nunca va en un pedido que no la necesita (rareza)', async () => {
  const { steam, requested } = provider({ GetSchemaForGame: SCHEMA })
  await steam.list(game).catch(() => {})
  const globalReq = requested.find((u) => u.includes('GetGlobalAchievementPercentagesForApp'))
  assert.ok(globalReq && !globalReq.includes(KEY))
})

test('formato de API key: 32 caracteres hexadecimales', () => {
  assert.equal(isValidApiKeyFormat(KEY), true)
  assert.equal(isValidApiKeyFormat('abc'), false)
  assert.equal(isValidApiKeyFormat(`${KEY}0`), false)
})

test('pickSteamId elige MostRecent, o el login más reciente', () => {
  const withFlag = `"users" { "76561198000000001" { "MostRecent" "0" "Timestamp" "9" } "76561198000000002" { "MostRecent" "1" "Timestamp" "1" } }`
  assert.equal(pickSteamId(withFlag), '76561198000000002')
  const noFlag = `"users" { "76561198000000001" { "Timestamp" "5" } "76561198000000002" { "Timestamp" "9" } }`
  assert.equal(pickSteamId(noFlag), '76561198000000002')
  assert.equal(pickSteamId('"users" { }'), null)
})
