import { useEffect, useState } from 'react'

export type Filter = 'all' | 'steam' | 'local'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'steam', label: 'Steam' },
  { id: 'local', label: 'Locales' },
]

interface Props {
  filter: Filter
  onFilter: (filter: Filter) => void
  onAdd: () => void
  muted: boolean
  onToggleMute: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}

export function TopBar({ filter, onFilter, onAdd, muted, onToggleMute, fullscreen, onToggleFullscreen }: Props) {
  return (
    <header className="topbar">
      <div className="brand">Game Hub</div>
      <nav className="filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={f.id === filter ? 'chip active' : 'chip'} onClick={() => onFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <button className="btn ghost" onClick={onAdd}>
          + Agregar juego
        </button>
        <button className="icon-btn" onClick={onToggleMute} title={muted ? 'Activar sonidos' : 'Silenciar sonidos'}>
          {muted ? <MutedIcon /> : <SpeakerIcon />}
        </button>
        <button
          className="icon-btn"
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Salir de pantalla completa (F11)' : 'Pantalla completa (F11)'}
        >
          {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
        </button>
        <Clock />
      </div>
    </header>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(timer)
  }, [])
  return <time className="clock">{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</time>
}

// Íconos SVG inline: sin dependencias y heredan el color del texto (currentColor).
const svg = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function SpeakerIcon() {
  return (
    <svg {...svg}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function MutedIcon() {
  return (
    <svg {...svg}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg {...svg}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

function ShrinkIcon() {
  return (
    <svg {...svg}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  )
}
