// La línea de logros debajo del título: progreso, o qué hace falta para verlos.

import type { AchievementsDTO } from '../../../shared/contract'

interface Props {
  data: AchievementsDTO | null
  loading: boolean
  onOpen: () => void
  onConnect: () => void
  onRetry: () => void
}

export function AchievementSummary({ data, loading, onOpen, onConnect, onRetry }: Props) {
  if (loading) return <div className="ach-summary muted">🏆 Cargando logros…</div>
  if (!data || data.status === 'unsupported' || data.status === 'none') return null

  if (data.status === 'not-configured') {
    return (
      <button className="ach-summary ach-connect" onClick={onConnect}>
        🏆 Conectá tu cuenta de Steam para ver tus logros
      </button>
    )
  }

  if (data.status === 'error') {
    return (
      <div className="ach-summary ach-error">
        <span>🏆 {data.message}</span>
        <button className="ach-retry" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    )
  }

  const pct = Math.round((data.unlocked / data.total) * 100)
  return (
    <button className="ach-summary ach-progress" onClick={onOpen} title="Ver logros">
      <span className="ach-count">
        🏆 {data.unlocked} / {data.total}
      </span>
      <span className="ach-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="ach-pct">{pct}%</span>
    </button>
  )
}
