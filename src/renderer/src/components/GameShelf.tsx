// La fila de portadas. La seleccionada se agranda y se centra sola.

import { useEffect, useRef } from 'react'
import type { GameDTO } from '../../../shared/contract'
import { Cover } from './Cover'

interface Props {
  games: GameDTO[]
  selectedId: string | null
  onSelect: (game: GameDTO) => void
  onActivate: (game: GameDTO) => void
}

export function GameShelf({ games, selectedId, onSelect, onActivate }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Al cambiar la selección (con flechas o, en la fase 2, con el mando), la tarjeta se centra sola.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedId])

  return (
    <div className="shelf" role="listbox" aria-label="Biblioteca">
      {games.map((game) => {
        const selected = game.id === selectedId
        return (
          <button
            key={game.id}
            ref={selected ? selectedRef : undefined}
            className={selected ? 'card selected' : 'card'}
            role="option"
            aria-selected={selected}
            tabIndex={-1} // el foco lo maneja la navegación por acciones, no el Tab del navegador
            onClick={() => onSelect(game)}
            onDoubleClick={() => onActivate(game)}
            title={game.title}
          >
            <Cover game={game} />
          </button>
        )
      })}
    </div>
  )
}
