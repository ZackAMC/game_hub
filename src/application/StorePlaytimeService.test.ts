import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { StorePlaytime } from '../domain/Playtime.js'
import type { StorePlaytimeProvider } from '../domain/ports/StorePlaytimeProvider.js'
import { StorePlaytimeService } from './StorePlaytimeService.js'

type Response = () => Promise<Map<string, StorePlaytime>>

const hours = (h: number): StorePlaytime => ({ totalMs: h * 3_600_000, recentMs: 0 })
const never = () => new Promise<void>(() => {}) // la espera nunca vence: el pedido siempre "llega a tiempo"

function setup(responses: Response[], sleep: (ms: number) => Promise<void> = never) {
  let clock = 0
  let calls = 0
  const errors: unknown[] = []
  const provider: StorePlaytimeProvider = {
    source: 'steam',
    fetchAll: () => responses[Math.min(calls++, responses.length - 1)]!(),
  }
  const service = new StorePlaytimeService({
    providers: [provider],
    now: () => clock,
    sleep,
    ttlMs: 1000,
    onError: (_s, e) => errors.push(e),
  })
  return { service, calls: () => calls, errors, advance: (ms: number) => (clock += ms) }
}

test('devuelve las horas con el id del hub', async () => {
  const { service } = setup([async () => new Map([['570', hours(10)]])])
  assert.deepEqual(await service.all(), new Map([['steam:570', hours(10)]]))
})

test('dentro del ttl no vuelve a pedir; después sí', async () => {
  const { service, calls, advance } = setup([async () => new Map([['570', hours(10)]])])
  await service.all()
  await service.all()
  assert.equal(calls(), 1)
  advance(1000)
  await service.all()
  assert.equal(calls(), 2)
})

test('si falla, conserva los datos anteriores', async () => {
  const { service, errors, advance } = setup([
    async () => new Map([['570', hours(10)]]),
    () => Promise.reject(new Error('caído')),
  ])
  await service.all()
  advance(1000)
  assert.deepEqual(await service.all(), new Map([['steam:570', hours(10)]]))
  assert.equal(errors.length, 1)
})

test('si la tienda tarda, responde sin esperarla y usa el dato en el próximo refresco', async () => {
  let release!: () => void
  const slow: Response = () =>
    new Promise((resolve) => {
      release = () => resolve(new Map([['570', hours(3)]]))
    })
  const { service, calls } = setup([slow], () => Promise.resolve()) // la espera vence enseguida
  assert.equal((await service.all()).size, 0)
  assert.equal((await service.all()).size, 0)
  assert.equal(calls(), 1) // un solo pedido en vuelo, no uno por refresco
  release()
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(await service.all(), new Map([['steam:570', hours(3)]]))
})

test('invalidate fuerza un pedido nuevo', async () => {
  const { service, calls } = setup([async () => new Map([['570', hours(1)]]), async () => new Map([['570', hours(2)]])])
  await service.all()
  service.invalidate('steam')
  assert.deepEqual(await service.all(), new Map([['steam:570', hours(2)]]))
  assert.equal(calls(), 2)
})
