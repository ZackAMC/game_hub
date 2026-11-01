// Estadísticas de tiempo de juego. Lo cargado a mano se aclara aparte:
// siempre tenés que saber qué número es MEDIDO y cuál es ESTIMADO por vos.

import type { HubPlaytimeDTO, PlaytimeDTO, StorePlaytimeDTO } from '../../../shared/contract'
import { formatDuration, timeAgo } from '../../../shared/format'

export function PlaytimeStats({ playtime }: { playtime: PlaytimeDTO }) {
  if (playtime.totalMs === 0) return null
  return playtime.kind === 'hub' ? <HubStats playtime={playtime} /> : <StoreStats playtime={playtime} />
}

// Steam solo informa total y últimas 2 semanas: mostramos eso y decimos de dónde sale.
function StoreStats({ playtime }: { playtime: StorePlaytimeDTO }) {
  return (
    <div className="playtime">
      <Stat label="Total" value={formatDuration(playtime.totalMs)} note={`según ${playtime.store === 'steam' ? 'Steam' : playtime.store}`} />
      <Stat label="Últimas 2 semanas" value={playtime.recentMs > 0 ? formatDuration(playtime.recentMs) : '—'} />
    </div>
  )
}

function HubStats({ playtime }: { playtime: HubPlaytimeDTO }) {
  return (
    <div className="playtime">
      <Stat
        label="Total"
        value={formatDuration(playtime.totalMs)}
        note={playtime.manualMs > 0 ? `incluye ${formatDuration(playtime.manualMs)} cargadas a mano` : null}
      />
      <Stat label="Esta semana" value={playtime.weekMs > 0 ? formatDuration(playtime.weekMs) : '—'} />
      <Stat label="Este mes" value={playtime.monthMs > 0 ? formatDuration(playtime.monthMs) : '—'} />
      {playtime.lastSession && (
        <Stat
          label="Última sesión"
          value={formatDuration(playtime.lastSession.durationMs)}
          note={timeAgo(playtime.lastSession.startedAt)}
        />
      )}
    </div>
  )
}

function Stat({ label, value, note = null }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="pt-stat">
      <span className="pt-label">{label}</span>
      <b>{value}</b>
      {note && <span className="pt-note">{note}</span>}
    </div>
  )
}
