import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOwnedGames, SteamPlaytime } from './SteamPlaytime.js'

test('convierte minutos a ms e ignora juegos nunca abiertos', () => {
  const result = parseOwnedGames([
    { appid: 570, playtime_forever: 90, playtime_2weeks: 30 },
    { appid: 730, playtime_forever: 60 },
    { appid: 440, playtime_forever: 0 },
  ])
  assert.deepEqual(
    result,
    new Map([
      ['570', { totalMs: 5_400_000, recentMs: 1_800_000 }],
      ['730', { totalMs: 3_600_000, recentMs: 0 }],
    ]),
  )
})

test('sin key no va a la red', async () => {
  let fetched = false
  const provider = new SteamPlaytime({
    getApiKey: async () => null,
    getSteamId: async () => '7656',
    fetchJson: async () => {
      fetched = true
      return { ok: true, status: 200, body: {} }
    },
  })
  assert.equal((await provider.fetchAll()).size, 0)
  assert.equal(fetched, false)
})

test('perfil privado (respuesta vacía) = sin datos, no error', async () => {
  const provider = new SteamPlaytime({
    getApiKey: async () => 'KEY',
    getSteamId: async () => '7656',
    fetchJson: async () => ({ ok: true, status: 200, body: { response: {} } }),
  })
  assert.equal((await provider.fetchAll()).size, 0)
})
