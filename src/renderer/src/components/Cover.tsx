// Portada de un juego. Si no hay imagen (o falla), dibuja una portada generada con su título.

import { useState } from 'react'
import type { GameDTO } from '../../../shared/contract'

export function Cover({ game }: { game: GameDTO }) {
  const [broken, setBroken] = useState(false)

  if (game.coverUrl && !broken) {
    return <img className="cover" src={game.coverUrl} alt={game.title} draggable={false} onError={() => setBroken(true)} />
  }
  return (
    <div className="cover generated" style={{ backgroundImage: placeholderGradient(game.title) }}>
      <span>{game.title}</span>
    </div>
  )
}

// El mismo título SIEMPRE da el mismo color: un hash simple del texto define el tono.
export function placeholderGradient(title: string): string {
  let hash = 0
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const hue = hash % 360
  return `linear-gradient(150deg, hsl(${hue} 55% 34%), hsl(${(hue + 50) % 360} 60% 14%))`
}
