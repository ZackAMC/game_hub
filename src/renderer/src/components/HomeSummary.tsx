// INICIO: solo lo esencial del juego seleccionado. Las acciones están adentro de su página.

import type { GameDTO } from '../../../shared/contract'
import { formatDuration, timeAgo } from '../../../shared/format'

export function HomeSummary({ game }: { game: GameDTO }) {
  const meta = [
    game.lastPlayed ? `Jugado ${timeAgo(game.lastPlayed)}` : 'Nunca jugado',
    game.playtime && game.playtime.totalMs > 0 ? `${formatDuration(game.playtime.totalMs)} en total` : null,
  ].filter(Boolean)

  return (
    // key: al cambiar de juego, el bloque se monta de nuevo y repite su animación de entrada.
    <section className="home-summary" key={game.id}>
      <span className={`source-badge ${game.source}`}>{game.source === 'steam' ? 'STEAM' : 'LOCAL'}</span>
      <h1 className="title">{game.title}</h1>
      <p className="meta">{meta.join('  ·  ')}</p>
    </section>
  )
}
