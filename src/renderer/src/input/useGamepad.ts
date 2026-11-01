// ADAPTADOR DE ENTRADA: mandos -> NavAction. Igual que useNavigation hace con el teclado.
// La UI recibe las MISMAS acciones venga de donde venga: no sabe si usás teclado o mando.

import { useEffect, useRef, useState } from 'react'
import type { NavAction } from '../useNavigation'
import { detectPadKind, readAllPads, RepeatController, type PadButton, type PadKind } from './gamepad'

const ACTIONS: Record<PadButton, NavAction> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  a: 'confirm',
  b: 'back',
  y: 'secondary',
  lb: 'prevTab',
  rb: 'nextTab',
}

// Momento de la última acción del mando. useNavigation lo consulta para ignorar las teclas
// "fantasma" que genera Steam Input cuando traduce el mando a teclado (si no, todo pasaría dos veces).
let lastPadActionAt = -Infinity
export function padActedRecently(windowMs = 250): boolean {
  return performance.now() - lastPadActionAt < windowMs
}

// Devuelve el tipo del mando que estás USANDO (el último que apretó algo), o null si no hay ninguno.
export function useGamepad(onAction: (action: NavAction) => void): PadKind | null {
  const handler = useRef(onAction)
  handler.current = onAction
  const [kind, setKind] = useState<PadKind | null>(null)

  useEffect(() => {
    const repeater = new RepeatController()
    let frame = 0
    let activeId: string | null = null

    // POLLING: la Gamepad API no avisa cuándo apretás un botón. Le preguntamos en cada cuadro.
    function loop(now: number) {
      const pads = navigator.getGamepads()
      // Sin foco (ej: estás jugando), el hub NO reacciona: si no, el mando movería el menú de fondo.
      if (document.hasFocus()) {
        const { held, activeId: usedNow } = readAllPads(pads)
        // Los íconos siguen al mando que REALMENTE usás, no al primero de la lista.
        if (usedNow && usedNow !== activeId) {
          activeId = usedNow
          setKind(detectPadKind(usedNow))
        }
        for (const button of repeater.update(held, now)) {
          lastPadActionAt = now
          handler.current(ACTIONS[button])
        }
      } else {
        repeater.reset()
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    // Si se desconecta el mando que estabas usando, buscamos si queda otro estándar.
    const onDisconnect = (e: GamepadEvent) => {
      if (e.gamepad.id !== activeId) return
      const other = navigator.getGamepads().find((p) => p?.connected && p.mapping === 'standard' && p.id !== activeId)
      activeId = other?.id ?? null
      setKind(other ? detectPadKind(other.id) : null)
    }
    window.addEventListener('gamepaddisconnected', onDisconnect)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  return kind
}
