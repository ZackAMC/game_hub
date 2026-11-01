// Cargar a mano las horas que jugaste ANTES de usar el hub.

import { useState } from 'react'
import type { GameDTO } from '../../../shared/contract'
import { formatDuration } from '../../../shared/format'

interface Props {
  game: GameDTO
  onSave: (hours: number) => Promise<void>
  onClose: () => void
}

export function PlaytimeDialog({ game, onSave, onClose }: Props) {
  // Solo los juegos medidos por el hub tienen tiempo manual.
  const hub = game.playtime?.kind === 'hub' ? game.playtime : null
  const currentHours = (hub?.manualMs ?? 0) / 3_600_000
  const [value, setValue] = useState(currentHours > 0 ? String(Math.round(currentHours * 10) / 10) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Acepta "50", "50.5" y también "50,5" (coma decimal, como escribimos acá).
  const hours = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(hours) && hours >= 0 && hours <= 100_000

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(hours)
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setSaving(false)
    }
  }

  const measured = hub?.measuredMs ?? 0

  return (
    <div className="overlay" role="dialog" aria-label="Tiempo previo" onClick={onClose}>
      <div className="panel narrow" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <h2>Tiempo previo</h2>
            <p className="muted">{game.title}</p>
          </div>
          <button className="btn ghost" onClick={onClose}>
            Cerrar <kbd>Esc</kbd>
          </button>
        </header>

        <p className="muted">
          ¿Cuántas horas jugaste <b>antes</b> de usar el hub? Se suman al total, pero se muestran aparte y no cuentan para
          "esta semana" ni "este mes", porque no sabemos cuándo fueron.
        </p>
        {measured > 0 && <p className="muted small">El hub ya midió {formatDuration(measured)}: eso no cambia.</p>}

        <form
          className="key-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void save()
          }}
        >
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ej: 50"
            autoFocus
          />
          <span className="unit">horas</span>
          <button className="btn primary" type="submit" disabled={!valid || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
        {!valid && value.trim() !== '' && <p className="ach-error small">Ingresá un número de horas (ej: 50 o 12,5).</p>}
        {error && <p className="ach-error small">{error}</p>}
      </div>
    </div>
  )
}
