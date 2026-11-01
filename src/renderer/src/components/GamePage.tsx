// PÁGINA DEL JUEGO: Jugar · Info · ⋯ (opciones).
//
// FOCO PROPIO: no usamos el foco del navegador (Tab), porque el mando no lo maneja.
// App lleva "qué está resaltado" (focus / menuIndex) y teclado, mando y mouse mueven ESE estado.
// Por eso los botones no toman el foco del DOM (tabIndex -1 + preventDefault en mousedown).

import type { ReactNode } from 'react'
import type { GameDTO, SessionDTO } from '../../../shared/contract'

export type PageAction = 'play' | 'info' | 'more'
export const PAGE_ACTIONS: PageAction[] = ['play', 'info', 'more']

export interface MenuItem {
  id: string
  label: string
  danger?: boolean
}

const PLAY_LABEL: Record<SessionDTO['state'], string> = {
  starting: 'Iniciando…',
  running: 'Jugando…',
  ended: '▶  Jugar',
  'not-started': '▶  Jugar',
}

interface Props {
  game: GameDTO
  focus: PageAction
  onFocus: (action: PageAction) => void
  onActivate: (action: PageAction) => void
  session: SessionDTO['state'] | null
  busy: boolean
  infoOpen: boolean
  summary?: ReactNode // siempre visible, entre el título y los botones (ej: tiempo de juego)
  info: ReactNode // contenido de "Info": GamePage no sabe de dónde salen los datos
  menuOpen: boolean
  menuItems: MenuItem[]
  menuIndex: number
  onMenuHover: (index: number) => void
  onMenuSelect: (index: number) => void
}

export function GamePage(props: Props) {
  const { game, focus, onFocus, onActivate, session, busy, infoOpen, summary, info, menuOpen } = props

  // COMPORTAMIENTO, igual para todos: el mouse mueve el foco propio y no roba el del DOM.
  const events = (action: PageAction) => ({
    tabIndex: -1,
    onMouseEnter: () => onFocus(action),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => onActivate(action),
  })
  // APARIENCIA: el resaltado se apaga mientras el menú está abierto (ahí el foco está en el menú).
  const classes = (base: string, action: PageAction, active = false) =>
    [base, focus === action && !menuOpen ? 'focused' : '', active ? 'active' : ''].filter(Boolean).join(' ')

  return (
    <section className="game-page" key={game.id}>
      <span className={`source-badge ${game.source}`}>{game.source === 'steam' ? 'STEAM' : 'LOCAL'}</span>
      <h1 className="title big">{game.title}</h1>
      {summary}

      <div className="page-actions">
        <button {...events('play')} className={classes('btn play', 'play')} disabled={busy}>
          {session ? PLAY_LABEL[session] : '▶  Jugar'}
        </button>
        <button {...events('info')} className={classes('round-btn', 'info', infoOpen)} title="Info">
          i
        </button>
        <div className="more-wrap">
          <button {...events('more')} className={classes('round-btn', 'more', menuOpen)} title="Opciones">
            ⋯
          </button>
          {menuOpen && <OptionsMenu {...props} />}
        </div>
      </div>

      {infoOpen && <div className="info-panel">{info}</div>}
    </section>
  )
}

function OptionsMenu({ menuItems, menuIndex, onMenuHover, onMenuSelect }: Props) {
  return (
    <ul className="options-menu" role="menu">
      {menuItems.map((item, i) => (
        <li key={item.id}>
          <button
            role="menuitem"
            tabIndex={-1}
            className={[i === menuIndex ? 'focused' : '', item.danger ? 'danger' : ''].join(' ')}
            onMouseEnter={() => onMenuHover(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onMenuSelect(i)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
