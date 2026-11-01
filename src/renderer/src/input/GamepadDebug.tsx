// Panel de DIAGNÓSTICO (F9): muestra lo que Chromium ve de cada mando, en vivo.
// Cuando algo de entrada "no anda", primero se MIRA la evidencia, después se arregla.

import { useEffect, useState } from 'react'

interface PadInfo {
  index: number
  id: string
  mapping: string
  pressed: number[]
  axes: string[]
}

export function GamepadDebug({ onClose }: { onClose: () => void }) {
  const [pads, setPads] = useState<PadInfo[]>([])
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    let frame = 0
    let last = 0
    function loop(now: number) {
      if (now - last > 100) {
        // ~10 veces por segundo alcanza para leer
        last = now
        setFocused(document.hasFocus())
        setPads(
          navigator
            .getGamepads()
            .filter((p): p is Gamepad => p !== null)
            .map((p) => ({
              index: p.index,
              id: p.id,
              mapping: p.mapping || '(vacío)',
              pressed: p.buttons.flatMap((b, i) => (b.pressed ? [i] : [])),
              axes: p.axes.map((a) => a.toFixed(2)),
            })),
        )
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="pad-debug">
      <header>
        <b>Diagnóstico de mandos</b>
        <button className="link" onClick={onClose}>
          cerrar (F9)
        </button>
      </header>
      <p className={focused ? 'muted' : 'ach-error'}>Ventana con foco: {focused ? 'sí' : 'NO (el hub ignora los mandos)'}</p>
      {pads.length === 0 ? (
        <p className="muted">Chromium no ve ningún mando. Apretá un botón del mando (sin eso no aparece).</p>
      ) : (
        pads.map((p) => (
          <div key={p.index} className={p.mapping === 'standard' ? 'pad-row' : 'pad-row ignored'}>
            <div>
              <b>#{p.index}</b> {p.id}
            </div>
            <div className="muted">
              mapping: {p.mapping} {p.mapping === 'standard' ? '✅ se usa' : '⛔ se ignora'}
            </div>
            <div>botones apretados: {p.pressed.length ? p.pressed.join(', ') : '—'}</div>
            <div className="muted">ejes: {p.axes.join('  ')}</div>
          </div>
        ))
      )}
    </div>
  )
}
