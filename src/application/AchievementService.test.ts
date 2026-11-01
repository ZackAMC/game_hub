import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AchievementsNotConfiguredError, type Achievement } from '../domain/Achievement.js'
import type { Game } from '../domain/Game.js'
import type { AchievementProvider } from '../domain/ports/AchievementProvider.js'
import { AchievementService } from './AchievementService.js'

const steamGame: Game = {
  id: 'steam:1',
  source: 'steam',
  nativeId: '1',
  title: 'Juego',
  installDir: 'X:\\',
  executable: null,
  sizeBytes: null,
  lastPlayed: null,
  playtime: null,
  coverPath: null,
  heroPath: null,
}
const localGame: Game = { ...steamGame, id: 'local:a', source: 'local', nativeId: 'a' }
const games = new Map([steamGame, localGame].map((g) => [g.id, g]))

function ach(id: string, unlocked: boolean, unlockedAt: number | null = null, globalPercent: number | null = null): Achievement {
  return {
    id,
    name: id,
    description: null,
    hidden: false,
    unlocked,
    unlockedAt: unlockedAt ? new Date(unlockedAt) : null,
    iconUrl: null,
    iconLockedUrl: null,
    globalPercent,
  }
}

class FakeProvider implements AchievementProvider {
  calls = 0
  constructor(private readonly behavior: () => Achievement[]) {}
  supports(game: Game) {
    return game.source === 'steam'
  }
  async list() {
    this.calls++
    return this.behavior()
  }
}

test('devuelve los logros ordenados: desbloqueados recientes primero, después bloqueados del más común al más raro', async () => {
  const provider = new FakeProvider(() => [ach('raro', false, null, 2), ach('viejo', true, 1000), ach('comun', false, null, 80), ach('nuevo', true, 5000)])
  const service = new AchievementService((id) => games.get(id), [provider])
  const result = await service.get('steam:1')
  assert.equal(result.status, 'ok')
  if (result.status !== 'ok') return
  assert.deepEqual(result.achievements.map((a) => a.id), ['nuevo', 'viejo', 'comun', 'raro'])
  assert.equal(result.unlocked, 2)
  assert.equal(result.total, 4)
})

test('juegos de una fuente sin logros devuelven "unsupported"', async () => {
  const service = new AchievementService((id) => games.get(id), [new FakeProvider(() => [])])
  assert.deepEqual(await service.get('local:a'), { status: 'unsupported' })
})

test('lista vacía significa que el juego no tiene logros', async () => {
  const service = new AchievementService((id) => games.get(id), [new FakeProvider(() => [])])
  assert.deepEqual(await service.get('steam:1'), { status: 'none' })
})

test('sin API key devuelve "not-configured"; otros errores, "error" con mensaje', async () => {
  const notConfigured = new AchievementService((id) => games.get(id), [
    new FakeProvider(() => {
      throw new AchievementsNotConfiguredError()
    }),
  ])
  assert.deepEqual(await notConfigured.get('steam:1'), { status: 'not-configured' })

  const failing = new AchievementService((id) => games.get(id), [
    new FakeProvider(() => {
      throw new Error('Perfil privado')
    }),
  ])
  assert.deepEqual(await failing.get('steam:1'), { status: 'error', message: 'Perfil privado' })
})

test('cachea 5 minutos, y no cachea errores', async () => {
  let t = 0
  let fail = true
  const provider = new FakeProvider(() => {
    if (fail) throw new Error('sin red')
    return [ach('a', true, 1)]
  })
  const service = new AchievementService((id) => games.get(id), [provider], () => t)

  assert.equal((await service.get('steam:1')).status, 'error')
  fail = false
  assert.equal((await service.get('steam:1')).status, 'ok') // el error no quedó cacheado
  await service.get('steam:1')
  assert.equal(provider.calls, 2) // la tercera vino de la caché

  t += 5 * 60_000
  await service.get('steam:1')
  assert.equal(provider.calls, 3) // venció la caché
})
