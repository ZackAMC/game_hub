import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startOfWeek, summarizePlaytime, type PlaySession } from './Playtime.js'

const H = 3_600_000
// Fechas en hora LOCAL (como las usa la app). Miércoles 5 de noviembre de 2025, 12:00.
const NOW = new Date(2025, 10, 5, 12, 0)
const session = (y: number, m: number, d: number, h: number, hours: number): PlaySession => ({
  startedAt: new Date(y, m, d, h, 0),
  durationMs: hours * H,
})

test('la semana empieza el lunes a las 00:00', () => {
  assert.deepEqual(startOfWeek(NOW), new Date(2025, 10, 3, 0, 0)) // lunes 3
  assert.deepEqual(startOfWeek(new Date(2025, 10, 9, 22, 0)), new Date(2025, 10, 3)) // domingo 9 -> lunes 3
  assert.deepEqual(startOfWeek(new Date(2025, 10, 3, 0, 30)), new Date(2025, 10, 3)) // el mismo lunes
})

test('total = medido + cargado a mano, y se informan por separado', () => {
  const s = summarizePlaytime({ sessions: [session(2025, 10, 4, 20, 2)], manualMs: 50 * H, legacyMs: H }, NOW)
  assert.equal(s.totalMs, 53 * H)
  assert.equal(s.measuredMs, 3 * H)
  assert.equal(s.manualMs, 50 * H)
})

test('una sesión que cruza el inicio de semana solo cuenta la parte de esta semana', () => {
  // domingo 2, 23:00 -> lunes 3, 01:00
  const s = summarizePlaytime({ sessions: [session(2025, 10, 2, 23, 2)], manualMs: 0, legacyMs: 0 }, NOW)
  assert.equal(s.weekMs, 1 * H)
  assert.equal(s.monthMs, 2 * H) // las dos horas son de noviembre
})

test('lo cargado a mano NO cuenta para "esta semana" (no sabemos cuándo fue)', () => {
  const s = summarizePlaytime({ sessions: [], manualMs: 50 * H, legacyMs: 0 }, NOW)
  assert.equal(s.weekMs, 0)
  assert.equal(s.lastSession, null)
})

test('la última sesión es la más reciente, no la última de la lista', () => {
  const nueva = session(2025, 10, 4, 20, 1)
  const vieja = session(2025, 9, 1, 10, 3)
  const s = summarizePlaytime({ sessions: [nueva, vieja], manualMs: 0, legacyMs: 0 }, NOW)
  assert.equal(s.lastSession, nueva)
})
