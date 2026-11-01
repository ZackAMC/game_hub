// Diálogo para conectar (o desconectar) la API key de Steam.
// La key viaja UNA vez a Main, que la verifica y la guarda cifrada. Nunca vuelve a la UI.

import { useState } from 'react'
import type { SteamKeyStatusDTO } from '../../../shared/contract'

interface Props {
  status: SteamKeyStatusDTO | null
  onSave: (key: string) => Promise<void>
  onClear: () => Promise<void>
  onClose: () => void
}

export function SteamKeyDialog({ status, onSave, onClear, onClose }: Props) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(key)
      setKey('')
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-label="Conectar Steam" onClick={onClose}>
      <div className="panel narrow" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <h2>Logros de Steam</h2>
          <button className="btn ghost" onClick={onClose}>
            Cerrar <kbd>Esc</kbd>
          </button>
        </header>

        {status?.configured ? (
          <>
            <p>✅ Tu cuenta está conectada. La key se guarda cifrada y solo tu usuario de Windows puede leerla.</p>
            <button className="btn ghost" onClick={() => void onClear()}>
              Desconectar
            </button>
          </>
        ) : (
          <>
            {status && !status.steamIdFound && (
              <p className="ach-error">No encontré tu cuenta de Steam en esta PC. Iniciá sesión en Steam al menos una vez.</p>
            )}
            <ol className="steps">
              <li>
                Abrí la página de Steam para crear tu key:{' '}
                <button className="link" onClick={() => void window.hub.openSteamKeyPage()}>
                  steamcommunity.com/dev/apikey
                </button>
              </li>
              <li>
                En <b>"Domain Name"</b> escribí <code>localhost</code>, aceptá los términos y tocá <b>Register</b>.
              </li>
              <li>Copiá la key (32 caracteres) y pegala acá abajo.</li>
              <li>
                En tu perfil de Steam, <b>Privacidad → "Detalles de juego"</b> tiene que estar en <b>Público</b>.
              </li>
            </ol>

            <form
              className="key-form"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Pegá tu API key"
                spellCheck={false}
                autoFocus
              />
              <button className="btn primary" type="submit" disabled={saving || key.trim().length === 0}>
                {saving ? 'Verificando…' : 'Conectar'}
              </button>
            </form>
            {error && <p className="ach-error">{error}</p>}
            <p className="muted small">⚠️ No compartas tu key con nadie: da acceso a datos de tu cuenta.</p>
          </>
        )}
      </div>
    </div>
  )
}
