// Barra de ayuda abajo a la derecha, con los íconos del mando que tenés conectado.
// Con un DualSense ves ✕ ○ △ L1 R1; con uno de Xbox, A B Y LB RB.

import type { PadKind } from '../input/gamepad'

const GLYPHS: Record<PadKind, { confirm: string; back: string; secondary: string; prev: string; next: string }> = {
  playstation: { confirm: '✕', back: '○', secondary: '△', prev: 'L1', next: 'R1' },
  xbox: { confirm: 'A', back: 'B', secondary: 'Y', prev: 'LB', next: 'RB' },
  generic: { confirm: 'A', back: 'B', secondary: 'Y', prev: 'LB', next: 'RB' },
}

interface Props {
  kind: PadKind
  confirmLabel: string | null // ej: "Jugar". null = no mostrar
  backLabel: string | null // ej: "Cerrar"
  secondaryLabel: string | null // ej: "Logros"
  showTabs: boolean
}

export function ControllerHints({ kind, confirmLabel, backLabel, secondaryLabel, showTabs }: Props) {
  const g = GLYPHS[kind]
  return (
    <div className={`pad-hints ${kind}`} aria-hidden>
      {showTabs && <Hint glyph={`${g.prev} ${g.next}`} label="Filtros" wide />}
      {secondaryLabel && <Hint glyph={g.secondary} label={secondaryLabel} />}
      {backLabel && <Hint glyph={g.back} label={backLabel} />}
      {confirmLabel && <Hint glyph={g.confirm} label={confirmLabel} />}
    </div>
  )
}

function Hint({ glyph, label, wide = false }: { glyph: string; label: string; wide?: boolean }) {
  return (
    <span className="pad-hint">
      <b className={wide ? 'glyph wide' : 'glyph'}>{glyph}</b>
      {label}
    </span>
  )
}
