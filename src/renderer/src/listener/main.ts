// EL OYENTE: una ventana invisible (1 px, transparente, sin clics) que escucha el botón PS/Guide.
//
// ¿Por qué una ventana aparte? Chromium solo le da datos del mando a una página VISIBLE. Con la
// cortina recogida, la app está oculta y sería sorda justo cuando más hace falta. Esta ventana
// nunca se oculta (salvo durante un juego), así que siempre oye.
//
// No usa React: no dibuja nada. Es un bucle chico que detecta el FLANCO (soltado -> apretado).

import { homePressed } from '../input/gamepad'

const POLL_MS = 50 // 20 veces por segundo: de sobra para un botón, casi cero CPU

let wasPressed = false

setInterval(() => {
  const pressed = homePressed(navigator.getGamepads())
  if (pressed && !wasPressed) void toggle()
  wasPressed = pressed
}, POLL_MS)

async function toggle(): Promise<void> {
  const state = await window.hub.curtainState()
  await window.hub.setCurtain(state === 'up' ? 'down' : 'up')
}
