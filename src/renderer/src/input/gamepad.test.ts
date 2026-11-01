import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectPadKind, readAllPads, readPad, RepeatController, type PadButton } from './gamepad'

function pad(pressedIndexes: number[] = [], axes: number[] = [0, 0], id = 'test', mapping = 'standard') {
  return { id, mapping, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressedIndexes.includes(i) })), axes }
}

test('readAllPads: un dispositivo "fantasma" primero en la lista NO tapa al mando real', () => {
  const phantom = pad([], [0, 0], 'HID-compliant game controller', '') // sin mapeo estándar
  const xbox = pad([0], [0, 0], 'Xbox 360 Controller (XInput STANDARD GAMEPAD)')
  const { held, activeId } = readAllPads([phantom, null, xbox])
  assert.deepEqual(held, new Set(['a']))
  assert.equal(activeId, xbox.id)
})

test('readAllPads ignora dispositivos sin mapeo estándar aunque "aprieten" algo', () => {
  const weird = pad([0, 12], [-1, -1], 'Volante raro', '')
  assert.deepEqual(readAllPads([weird]).held, new Set())
})

test('readAllPads combina varios mandos y sin input no hay mando activo', () => {
  const a = pad([14], [0, 0], 'pad A')
  const b = pad([1], [0, 0], 'pad B')
  assert.deepEqual(readAllPads([a, b]).held, new Set(['left', 'b']))
  assert.equal(readAllPads([pad(), pad()]).activeId, null)
})
const set = (...buttons: PadButton[]) => new Set(buttons)

test('readPad lee botones del standard mapping', () => {
  assert.deepEqual(readPad(pad([0, 15])), set('a', 'right'))
  assert.deepEqual(readPad(pad([1, 3, 4, 5])), set('b', 'y', 'lb', 'rb'))
})

test('el stick respeta la zona muerta (drift) y en diagonal gana el eje dominante', () => {
  assert.deepEqual(readPad(pad([], [0.3, -0.2])), set()) // drift: ignorado
  assert.deepEqual(readPad(pad([], [0.9, 0.6])), set('right')) // diagonal, domina X
  assert.deepEqual(readPad(pad([], [-0.2, -0.8])), set('up'))
})

test('un botón mantenido dispara UNA sola vez (flanco)', () => {
  const r = new RepeatController()
  assert.deepEqual(r.update(set('a'), 0), ['a'])
  assert.deepEqual(r.update(set('a'), 16), [])
  assert.deepEqual(r.update(set('a'), 2000), []) // A no repite nunca
  assert.deepEqual(r.update(set(), 2016), [])
  assert.deepEqual(r.update(set('a'), 2032), ['a']) // soltar y volver a apretar sí dispara
})

test('una dirección mantenida repite: pausa inicial y después ritmo constante', () => {
  const r = new RepeatController(380, 110)
  assert.deepEqual(r.update(set('right'), 0), ['right'])
  assert.deepEqual(r.update(set('right'), 300), []) // todavía en la pausa
  assert.deepEqual(r.update(set('right'), 400), ['right']) // primera repetición
  assert.deepEqual(r.update(set('right'), 450), []) // muy pronto
  assert.deepEqual(r.update(set('right'), 515), ['right'])
})

test('reset olvida todo (ej: la ventana perdió el foco)', () => {
  const r = new RepeatController()
  r.update(set('a'), 0)
  r.reset()
  assert.deepEqual(r.update(set('a'), 10), ['a'])
})

test('detectPadKind reconoce Xbox y PlayStation por nombre o vendor', () => {
  assert.equal(detectPadKind('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation')
  assert.equal(detectPadKind('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'xbox')
  assert.equal(detectPadKind('8BitDo Pro 2 (Vendor: 2dc8)'), 'generic')
})
