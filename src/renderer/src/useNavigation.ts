// ADAPTADOR DE ENTRADA: teclado -> ACCIONES de la interfaz.
// La UI solo entiende acciones. El mando (input/useGamepad) produce estas mismas acciones,
// y ni App ni los componentes saben de dónde vino cada una.

import { useEffect, useRef } from 'react'
import { padActedRecently } from './input/useGamepad'

export type NavAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'back'
  | 'secondary' // acción extra del juego seleccionado (Y / △)
  | 'prevTab' // filtro anterior (LB / L1)
  | 'nextTab' // filtro siguiente (RB / R1)

const KEYS: Record<string, NavAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'confirm',
  Escape: 'back',
  PageUp: 'prevTab',
  PageDown: 'nextTab',
}

export function useNavigation(onAction: (action: NavAction) => void): void {
  // Guardamos el callback en un ref para no re-suscribir el listener en cada render.
  const handler = useRef(onAction)
  handler.current = onAction

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const action = KEYS[e.key]
      if (!action) return
      // Escribiendo en un campo de texto, las flechas mueven el cursor, no la biblioteca.
      // Escape sí pasa: sirve para cerrar el diálogo.
      if (action !== 'back' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return
      // Si el foco está en un botón, Enter ya lo "clickea": no lanzamos el juego dos veces.
      if (action === 'confirm' && e.target instanceof HTMLButtonElement) return
      // Tecla "fantasma" generada por Steam Input a partir del mando: el mando ya la procesó.
      if (padActedRecently()) {
        e.preventDefault()
        return
      }
      e.preventDefault()
      handler.current(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
