import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Game } from '../domain/Game.js'
import type { GameSource } from '../domain/ports/GameSource.js'
import { SessionTracker } from './SessionTracker.js'

const game: Game = {
  id: 'local:a',
  source: 'local',
  nativeId: 'a',
  title: 'Hades',
  installDir: 'F:\\Juegos\\Hades',
  executable: 'F:\\Juegos\\Hades\\Hades.exe',
  sizeBytes: null,
  lastPlayed: null,
  playtime: null,
  coverPath: null,
  heroPath: null,
}

// Simula el mundo: una secuencia de respuestas a "¿está corriendo?" y un reloj falso.
function setup(answers: (boolean | Error)[]) {
  let t = 0
  const log: string[] = []
  const source: GameSource = {
    id: 'local',
    list: async () => [],
    launch: async () => {},
    isRunning: async () => {
      const next = answers.shift() ?? false
      if (next instanceof Error) throw next
      return next
    },
  }
  const tracker = new SessionTracker({
    sources: [source],
    sleep: async (ms) => {
      t += ms
    },
    now: () => t,
    pollMs: 1000,
    startTimeoutMs: 5000,
  })
  const events = {
    onStarted: () => {
      log.push(`started@${t}`)
    },
    onEnded: (_g: Game, ms: number) => {
      log.push(`ended:${ms}`)
    },
    onNeverStarted: () => {
      log.push('never')
    },
  }
  return { tracker, events, log }
}

test('detecta el arranque, el final y mide la duración', async () => {
  // tarda 2 consultas en arrancar, corre 3 consultas, termina
  const { tracker, events, log } = setup([false, false, true, true, true, false])
  await tracker.track(game, events)
  assert.deepEqual(log, ['started@2000', 'ended:2000'])
})

test('si nunca arranca, avisa al vencer el tiempo límite', async () => {
  const { tracker, events, log } = setup(Array(20).fill(false))
  await tracker.track(game, events)
  assert.deepEqual(log, ['never'])
})

test('un error puntual en la consulta NO corta una sesión que sigue viva', async () => {
  const { tracker, events, log } = setup([true, new Error('PowerShell tardó'), true, false])
  await tracker.track(game, events)
  assert.deepEqual(log, ['started@0', 'ended:2000'])
})

test('cancelar detiene el seguimiento sin disparar eventos', async () => {
  const { tracker, events, log } = setup([true, true, true, true])
  const tracking = tracker.track(game, events)
  tracker.cancel() // ej: lanzaste otro juego antes de que este arrancara
  await tracking
  assert.deepEqual(log, [])
})
