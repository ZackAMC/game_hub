// Cambiar el nombre de un juego local. La validación de verdad la hace el dominio en Main:
// acá solo avisamos antes, para no esperar un error que ya sabemos que va a venir.

import { useState } from 'react'
import type { GameDTO } from '../../../shared/contract'

const MAX_LENGTH = 100 // mismo límite que MAX_TITLE_LENGTH del dominio

interface Props {
  game: GameDTO
  onSave: (title: string) => Promise<void>
  onClose: () => void
}

export function RenameDialog({ game, onSave, onClose }: Props) {
  const [value, setValue] = useState(game.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clean = value.replace(/\s+/g, ' ').trim()
  const valid = clean.length > 0 && clean.length <= MAX_LENGTH && clean !== game.title

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(clean)
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setSaving(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-label="Cambiar nombre" onClick={onClose}>
      <div className="panel narrow" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <h2>Cambiar nombre</h2>
            <p className="muted">{game.title}</p>
          </div>
          <button className="btn ghost" onClick={onClose}>
            Cerrar <kbd>Esc</kbd>
          </button>
        </header>

        <p className="muted small">Si después buscás portadas, se van a buscar con este nombre.</p>

        <form
          className="key-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void save()
          }}
        >
          <input
            value={value}
            maxLength={MAX_LENGTH + 20}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            autoFocus
          />
          <button className="btn primary" type="submit" disabled={!valid || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
        {clean.length > MAX_LENGTH && <p className="ach-error small">Hasta {MAX_LENGTH} caracteres.</p>}
        {error && <p className="ach-error small">{error}</p>}
      </div>
    </div>
  )
}
