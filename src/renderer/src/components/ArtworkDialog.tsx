// Diálogo para ponerle imágenes a un juego local: buscar en Steam y elegir, o subir archivos propios.
// Nada se aplica solo: VOS confirmás cuál es el juego correcto.

import { useEffect, useState } from 'react'
import type { ArtworkCandidateDTO, ArtworkKindDTO, GameDTO } from '../../../shared/contract'

interface Props {
  game: GameDTO
  onApply: (candidateId: string) => Promise<void>
  onPickFile: (kind: ArtworkKindDTO) => Promise<void>
  onClear: () => Promise<void>
  onClose: () => void
}

export function ArtworkDialog({ game, onApply, onPickFile, onClear, onClose }: Props) {
  const [term, setTerm] = useState(game.title)
  const [results, setResults] = useState<ArtworkCandidateDTO[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sgdbConnected, setSgdbConnected] = useState<boolean | null>(null)

  useEffect(() => {
    void window.hub.sgdbKeyStatus().then(setSgdbConnected)
  }, [])

  async function search(query: string) {
    setSearching(true)
    setError(null)
    try {
      setResults(await window.hub.artworkSearch(query))
    } catch (err) {
      setError(clean(err))
    } finally {
      setSearching(false)
    }
  }

  // Al abrir, buscamos automáticamente con el nombre del juego.
  useEffect(() => {
    void search(game.title)
  }, [game.title])

  async function run(id: string, action: () => Promise<void>) {
    setApplyingId(id)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(clean(err))
    } finally {
      setApplyingId(null)
    }
  }

  const busy = applyingId !== null
  const hasArt = game.coverUrl !== null || game.heroUrl !== null

  return (
    <div className="overlay" role="dialog" aria-label={`Imágenes de ${game.title}`} onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <h2>Imágenes de {game.title}</h2>
            <p className="muted">Elegí el juego correcto: se descargan la portada y el fondo.</p>
            {sgdbConnected === false && (
              <SgdbConnect
                onConnected={() => {
                  setSgdbConnected(true)
                  void search(term) // re-busca: ahora también con SteamGridDB
                }}
              />
            )}
          </div>
          <button className="btn ghost" onClick={onClose}>
            {hasArt ? 'Listo' : 'Omitir'} <kbd>Esc</kbd>
          </button>
        </header>

        <form
          className="key-form"
          onSubmit={(e) => {
            e.preventDefault()
            void search(term)
          }}
        >
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Nombre del juego" spellCheck={false} />
          <button className="btn primary" type="submit" disabled={searching || term.trim() === ''}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
        {error && <p className="ach-error">{error}</p>}

        <div className="art-results">
          {results?.length === 0 && !searching && (
            <p className="muted">No encontré nada. Probá con otro nombre o elegí imágenes de tu PC.</p>
          )}
          {results?.map((c) => (
            <button
              key={c.id}
              className={applyingId === c.id ? 'art-option applying' : 'art-option'}
              onClick={() => void run(c.id, () => onApply(c.id))}
              disabled={busy}
              title={c.title}
            >
              <div className="art-thumb-wrap">
                <Thumb candidate={c} />
                <em className={`art-source ${c.sourceLabel === 'Steam' ? 'steam' : 'sgdb'}`}>{c.sourceLabel}</em>
              </div>
              <span>{applyingId === c.id ? 'Descargando…' : c.title}</span>
            </button>
          ))}
        </div>

        <footer className="art-footer">
          <button className="btn ghost" disabled={busy} onClick={() => void run('file-cover', () => onPickFile('cover'))}>
            Portada desde mi PC…
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => void run('file-hero', () => onPickFile('hero'))}>
            Fondo desde mi PC…
          </button>
          {hasArt && (
            <button className="btn ghost danger-text" disabled={busy} onClick={() => void run('clear', onClear)}>
              Quitar imágenes
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

// Conectar SteamGridDB sin salir del diálogo. Se pliega para no molestar a quien no lo necesita.
function SgdbConnect({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button className="link sgdb-cta" onClick={() => setOpen(true)}>
        ¿No aparece? Conectá SteamGridDB para buscar también juegos de consola →
      </button>
    )
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await window.hub.setSgdbKey(key)
      onConnected()
    } catch (err) {
      setError(clean(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sgdb-connect">
      <p className="muted small">
        1. Entrá a{' '}
        <button className="link" onClick={() => void window.hub.openSgdbKeyPage()}>
          steamgriddb.com → Preferencias → API
        </button>{' '}
        (iniciás sesión con Steam). 2. Generá la key y pegala acá. Se guarda cifrada.
      </p>
      <form
        className="key-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="API key de SteamGridDB" autoFocus />
        <button className="btn primary" type="submit" disabled={saving || key.trim() === ''}>
          {saving ? 'Verificando…' : 'Conectar'}
        </button>
      </form>
      {error && <p className="ach-error small">{error}</p>}
    </div>
  )
}

// Si la portada vertical no existe para ese juego, mostramos el título en lugar de una imagen rota.
function Thumb({ candidate }: { candidate: ArtworkCandidateDTO }) {
  const [broken, setBroken] = useState(false)
  if (!candidate.thumbUrl || broken) return <div className="art-thumb missing">{candidate.title}</div>
  return <img className="art-thumb" src={candidate.thumbUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
}

function clean(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
