// Confirmación para desinstalar un juego LOCAL. Muestra exactamente QUÉ se va a borrar.
// El botón por defecto es "Cancelar": borrar tiene que ser una decisión, no un reflejo.
// Es un diálogo de la app (no nativo) para poder manejarlo con el mando. La seguridad real
// no está acá: Main vuelve a aplicar la regla de carpetas antes de borrar, siempre.

import { useEffect, useState } from 'react'
import type { GameDTO, UninstallPreviewDTO } from '../../../shared/contract'
import { formatBytes } from '../../../shared/format'

export type UninstallChoice = 'cancel' | 'confirm'

interface Props {
  game: GameDTO
  focus: UninstallChoice
  onFocus: (choice: UninstallChoice) => void
  onChoose: (choice: UninstallChoice, preview: UninstallPreviewDTO | null) => void
  working: boolean
}

export function UninstallDialog({ game, focus, onFocus, onChoose, working }: Props) {
  const [preview, setPreview] = useState<UninstallPreviewDTO | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.hub.uninstallPreview(game.id).then(setPreview, (err: unknown) => setError(String(err)))
  }, [game.id])

  const canConfirm = preview?.allowed === true && !working
  const button = (choice: UninstallChoice, label: string, extra = '') => (
    <button
      className={['btn', extra, focus === choice ? 'focused' : ''].join(' ')}
      tabIndex={-1}
      disabled={choice === 'confirm' && !canConfirm}
      onMouseEnter={() => onFocus(choice)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChoose(choice, preview)}
    >
      {label}
    </button>
  )

  return (
    <div className="overlay" role="dialog" aria-label={`Desinstalar ${game.title}`} onClick={() => onChoose('cancel', preview)}>
      <div className="panel narrow" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>¿Desinstalar {game.title}?</h2>
        </header>

        {!preview && !error && <p className="muted">Calculando qué se va a borrar…</p>}
        {error && <p className="ach-error">{error}</p>}

        {preview && !preview.allowed && (
          <>
            <p className="ach-error">No se puede desinstalar desde el hub: {preview.reason}</p>
            <p className="muted small">Carpeta: {preview.folder}</p>
          </>
        )}

        {preview?.allowed && (
          <>
            <p>Se va a mandar a la Papelera esta carpeta completa:</p>
            <div className="uninstall-target">
              <code>{preview.folder}</code>
              <span className="muted">
                {formatBytes(preview.bytes)} · {preview.files.toLocaleString('es-AR')} archivos
              </span>
            </div>
            <p className="muted small">
              Podés recuperarla desde la Papelera. Ojo: si la carpeta es más grande que el espacio de la Papelera, Windows
              podría eliminarla definitivamente. Las partidas guardadas suelen estar en Documentos o AppData y no se tocan.
            </p>
          </>
        )}

        <div className="dialog-actions">
          {button('cancel', 'Cancelar', 'ghost')}
          {button('confirm', working ? 'Desinstalando…' : 'Desinstalar', 'danger-solid')}
        </div>
      </div>
    </div>
  )
}
