// Panel con TODOS los logros del juego. Se cierra con Escape (acción "back") o con el botón.

import { forwardRef } from 'react'
import type { AchievementDTO, GameDTO } from '../../../shared/contract'

interface Props {
  game: GameDTO
  achievements: AchievementDTO[]
  unlocked: number
  total: number
  onClose: () => void
}

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

// forwardRef: App necesita el elemento con scroll para moverlo con ↑ ↓ (y con el mando, en la fase 2).
export const AchievementsPanel = forwardRef<HTMLDivElement, Props>(function AchievementsPanel(
  { game, achievements, unlocked, total, onClose },
  listRef,
) {
  const pct = Math.round((unlocked / total) * 100)
  return (
    <div className="overlay" role="dialog" aria-label={`Logros de ${game.title}`} onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <div>
            <h2>{game.title}</h2>
            <p className="muted">
              {unlocked} de {total} logros · {pct}%
            </p>
          </div>
          <button className="btn ghost" onClick={onClose}>
            Cerrar <kbd>Esc</kbd>
          </button>
        </header>
        <div className="ach-bar big">
          <i style={{ width: `${pct}%` }} />
        </div>

        <div className="ach-list" ref={listRef}>
          {achievements.map((a) => (
            <AchievementRow key={a.id} achievement={a} />
          ))}
        </div>
      </div>
    </div>
  )
})

function AchievementRow({ achievement: a }: { achievement: AchievementDTO }) {
  const secret = a.hidden && !a.unlocked // no spoileamos logros ocultos
  const icon = a.unlocked ? a.iconUrl : (a.iconLockedUrl ?? a.iconUrl)
  return (
    <div className={a.unlocked ? 'ach-row unlocked' : 'ach-row'}>
      {icon ? <img className="ach-icon" src={icon} alt="" loading="lazy" /> : <div className="ach-icon placeholder">🏆</div>}
      <div className="ach-text">
        <b>{secret ? 'Logro oculto' : a.name}</b>
        <span className="muted">{secret ? 'Seguí jugando para descubrirlo.' : (a.description ?? '')}</span>
      </div>
      <div className="ach-side">
        {a.unlocked && a.unlockedAt && <span>{dateFormat.format(a.unlockedAt)}</span>}
        {a.globalPercent !== null && (
          <span className={a.globalPercent < 5 ? 'rarity rare' : 'rarity'}>{a.globalPercent.toFixed(1)}% de jugadores</span>
        )}
      </div>
    </div>
  )
}
