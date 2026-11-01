// LA CORTINA: la app vive "enrollada" arriba del monitor principal y baja cuando la llamás.
//
// Son DOS ventanas:
//   - main:     la app. Sin marco, TRANSPARENTE y del tamaño exacto del monitor principal.
//   - listener: 1 px invisible, siempre encima y sin captar clics. Escucha el botón PS/Guide,
//               porque Chromium solo le da el mando a ventanas VISIBLES y la app se oculta.
//
// La animación NO mueve la ventana (setBounds a 60 fps en Windows va a los saltos): la ventana
// queda quieta y transparente, y es la UI la que se desliza con un transform de CSS.
// Por eso "subir" es: avisar a la UI, esperar que termine la animación y RECIÉN ahí ocultar.

import { BrowserWindow, screen } from 'electron'
import { IPC, type CurtainState } from '../shared/contract.js'

export const CURTAIN_ANIMATION_MS = 420 // mismo valor que la transición de .curtain en styles.css

export class Curtain {
  private state: CurtainState = 'up'
  private hideTimer: NodeJS.Timeout | null = null
  private listenerAllowed = true

  constructor(
    private readonly main: BrowserWindow,
    private readonly listener: BrowserWindow,
    // Inyectado: en Windows usa AttachThreadInput (ver adapters/system/foreground.ts).
    private readonly forceForeground: (win: BrowserWindow) => void,
  ) {
    // SIEMPRE el monitor principal, aunque cambie (otro monitor, otra resolución, otra escala).
    const place = () => this.place()
    screen.on('display-metrics-changed', place)
    screen.on('display-added', place)
    screen.on('display-removed', place)
    this.place()
  }

  get current(): CurtainState {
    return this.state
  }

  down(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = null
    if (this.state === 'down' && this.main.isVisible()) {
      this.forceForeground(this.main)
      return this.main.focus()
    }

    this.state = 'down'
    this.place()
    this.main.show()
    // Con foco REAL: si no, Windows deja la barra de tareas encima y el teclado no llega.
    this.forceForeground(this.main)
    this.main.focus()
    this.broadcast()
  }

  up(): void {
    if (this.state === 'up') return
    this.state = 'up'
    this.broadcast()
    // La UI se está deslizando hacia arriba: ocultamos la ventana cuando ya no se ve nada.
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null
      if (this.state === 'up') this.main.hide()
    }, CURTAIN_ANIMATION_MS + 60)
  }

  set(state: CurtainState): void {
    if (state === 'down') this.down()
    else this.up()
  }

  toggle(): void {
    this.set(this.state === 'down' ? 'up' : 'down')
  }

  // Mientras corre un juego, el oyente se oculta: una ventana "siempre encima" sobre el juego,
  // aunque sea de 1 px, puede impedir que Windows le dé al juego su modo de pantalla más rápido.
  setListenerActive(active: boolean): void {
    this.listenerAllowed = active
    if (active) this.listener.showInactive()
    else this.listener.hide()
  }

  showListener(): void {
    if (this.listenerAllowed) this.listener.showInactive()
  }

  private place(): void {
    const area = screen.getPrimaryDisplay().bounds
    this.main.setBounds(area)
    this.listener.setBounds({ x: area.x, y: area.y, width: 1, height: 1 })
  }

  private broadcast(): void {
    for (const win of [this.main, this.listener]) {
      if (!win.isDestroyed()) win.webContents.send(IPC.curtainChanged, this.state)
    }
  }
}
