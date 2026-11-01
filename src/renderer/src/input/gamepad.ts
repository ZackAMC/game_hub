// Lógica PURA del mando: foto del estado -> botones lógicos -> acciones con repetición.
// No toca `navigator` ni el DOM, así que se testea sin tener un mando conectado.
//
// "Standard mapping" de la Gamepad API (Chromium lo aplica a Xbox y DualSense):
//   0 A / ✕     1 B / ○     2 X / □     3 Y / △
//   4 LB / L1   5 RB / R1   6 LT / L2   7 RT / R2
//   8 View / Create   9 Menu / Options
//   16 Guide / PS (el botón central)
//   12 ↑  13 ↓  14 ←  15 →   (cruceta)
//   axes[0], axes[1] = stick izquierdo (-1..1)

export type PadButton = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'y' | 'lb' | 'rb'
export type PadKind = 'xbox' | 'playstation' | 'generic'

// Lo mínimo que necesitamos de un Gamepad real. Así los tests pasan objetos simples.
export interface PadSnapshot {
  id: string
  mapping: string // "standard" = los botones están donde dice la tabla de arriba
  buttons: readonly { pressed: boolean }[]
  axes: readonly number[]
}

const BUTTON_INDEX: Partial<Record<PadButton, number>> = { a: 0, b: 1, y: 3, lb: 4, rb: 5, up: 12, down: 13, left: 14, right: 15 }

// Zona muerta: los sticks NUNCA vuelven exacto a 0 (desgaste, drift). Debajo de esto, lo ignoramos.
const STICK_DEADZONE = 0.5

export function readPad(pad: PadSnapshot): Set<PadButton> {
  const held = new Set<PadButton>()
  for (const [button, index] of Object.entries(BUTTON_INDEX) as [PadButton, number][]) {
    if (pad.buttons[index]?.pressed) held.add(button)
  }

  // El stick izquierdo también navega. En diagonal gana el eje dominante:
  // si no, mover "arriba-derecha" dispararía dos movimientos a la vez.
  const x = pad.axes[0] ?? 0
  const y = pad.axes[1] ?? 0
  if (Math.max(Math.abs(x), Math.abs(y)) >= STICK_DEADZONE) {
    if (Math.abs(x) >= Math.abs(y)) held.add(x > 0 ? 'right' : 'left')
    else held.add(y > 0 ? 'down' : 'up')
  }
  return held
}

// Lee TODOS los mandos a la vez: cualquiera puede controlar la app.
// Solo se usan los de mapeo "standard". Otros dispositivos que Windows reporta como mando
// (software de RGB, volantes, dispositivos virtuales) tienen botones en posiciones impredecibles,
// y podrían "apretar" cosas solos. También devuelve CUÁL mando se está usando, para mostrar sus íconos.
export function readAllPads(pads: readonly (PadSnapshot | null)[]): { held: Set<PadButton>; activeId: string | null } {
  const held = new Set<PadButton>()
  let activeId: string | null = null
  for (const pad of pads) {
    if (!pad || pad.mapping !== 'standard') continue
    const buttons = readPad(pad)
    if (buttons.size > 0) activeId ??= pad.id
    for (const b of buttons) held.add(b)
  }
  return { held, activeId }
}

const REPEATABLE = new Set<PadButton>(['up', 'down', 'left', 'right'])

// Convierte "botones mantenidos" en "disparos", como hace una consola:
// - Al apretar: dispara UNA vez (detección de flanco).
// - Direcciones mantenidas: pausa inicial y después repetición rápida.
// - Botones de acción (A, B…) mantenidos: NO repiten. Mantener A no lanza el juego 10 veces.
export class RepeatController {
  private held = new Map<PadButton, { since: number; lastFire: number }>()

  constructor(
    private readonly initialDelay = 380,
    private readonly interval = 110,
  ) {}

  update(pressed: Set<PadButton>, now: number): PadButton[] {
    const fired: PadButton[] = []

    for (const button of pressed) {
      const state = this.held.get(button)
      if (!state) {
        fired.push(button) // flanco: recién apretado
        this.held.set(button, { since: now, lastFire: now })
      } else if (
        REPEATABLE.has(button) &&
        now - state.since >= this.initialDelay &&
        now - state.lastFire >= this.interval
      ) {
        fired.push(button)
        state.lastFire = now
      }
    }

    // Lo que se soltó se olvida: la próxima vez que se apriete, vuelve a ser un flanco.
    for (const button of [...this.held.keys()]) if (!pressed.has(button)) this.held.delete(button)
    return fired
  }

  reset(): void {
    this.held.clear()
  }
}

// Sony = vendor 054c, Microsoft = 045e. Chromium incluye el vendor en el id del mando.
export function detectPadKind(id: string): PadKind {
  if (/054c|dualsense|dualshock|wireless controller/i.test(id)) return 'playstation'
  if (/045e|xbox|xinput/i.test(id)) return 'xbox'
  return 'generic'
}

// El botón central (PS / Guide) de CUALQUIER mando con mapping estándar.
export const HOME_BUTTON = 16

export function homePressed(pads: readonly (PadSnapshot | null)[]): boolean {
  return pads.some((p) => p !== null && p.mapping === 'standard' && p.buttons[HOME_BUTTON]?.pressed === true)
}
