// Estadísticas de tiempo de juego. Lo cargado a mano se aclara aparte:
// siempre tenés que saber qué número es MEDIDO y cuál es ESTIMADO por vos.

import type { PlaytimeDTO } from '../../../shared/contract'
import { formatDuration, timeAgo } from '../../../shared/format'

export function PlaytimeStats({ playtime }: { playtime: PlaytimeDTO }) {
  if (playtime.totalMs === 0) return null

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
