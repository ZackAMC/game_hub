// Fondo de pantalla completa con la imagen del juego seleccionado.
// La `key` fuerza un elemento NUEVO por juego, así la animación de fundido se repite en cada cambio.

import type { GameDTO } from '../../../shared/contract'
import { placeholderGradient } from './Cover'

export function Backdrop({ game }: { game: GameDTO | null }) {
  if (!game) return <div className="backdrop" />
  const image = game.heroUrl ?? game.coverUrl
  return (
    <div className="backdrop">
      <div
        key={game.id}
        className={image ? 'backdrop-img' : 'backdrop-img fallback'}
        style={{ backgroundImage: image ? `url("${image}")` : placeholderGradient(game.title) }}
      />
      <div className="backdrop-shade" />
    </div>
  )
}
