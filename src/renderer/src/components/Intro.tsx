// LA INTRO: el ícono de la app se arma en pantalla, con su música (sounds.intro()).
//
// Fases (las maneja App):
//   waiting -> pantalla negra quieta: la cortina está bajando, todavía no arranca nada.
//   playing -> corre la animación y el sonido. Al terminar, avisa con onFinish.
//   leaving -> se desvanece y revela el inicio. Al terminar, avisa con onGone.
//
// La animación es CSS puro (styles.css, sección Intro): React solo pone las clases.
// Los tiempos del CSS y los del sonido están sincronizados a mano: si cambiás uno, cambiá el otro.

import { useEffect, useMemo, useRef } from 'react'
import { sounds } from '../sound/SoundEngine'

export type IntroPhase = 'waiting' | 'playing' | 'leaving' | 'done'

const PLAY_MS = 3000 // desde que arranca hasta que empieza a desvanecerse
const FADE_MS = 650 // desvanecido natural
const SKIP_FADE_MS = 300 // desvanecido cuando la salteás

interface Props {
  phase: Exclude<IntroPhase, 'done'>
  onFinish: () => void
  onGone: () => void
  onSkip: () => void
}

export function Intro({ phase, onFinish, onGone, onSkip }: Props) {
  const finished = useRef(false)
  const callbacks = useRef({ onFinish, onGone })
  callbacks.current = { onFinish, onGone }

  // Sonido + reloj de la animación. Si se desmonta o cambia de fase ANTES de terminar
  // (la salteaste), el sonido se apaga con un fundido; si terminó sola, la cola suena hasta el final.
  const playing = phase === 'playing'
  useEffect(() => {
    if (!playing) return
    const stopSound = sounds.intro()
    const timer = setTimeout(() => {
      finished.current = true
      callbacks.current.onFinish()
    }, PLAY_MS)
    return () => {
      clearTimeout(timer)
      if (!finished.current) stopSound()
    }
  }, [playing])

  const leaving = phase === 'leaving'
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => callbacks.current.onGone(), finished.current ? FADE_MS : SKIP_FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  const particles = useMemo(makeParticles, [])

  return (
    <div
      className={['intro', phase, leaving && !finished.current ? 'skipped' : ''].join(' ')}
      onClick={onSkip}
      aria-hidden="true"
    >
      <div className="intro-glow" />
      <div className="intro-particles">
        {particles.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="intro-mark">
        <svg viewBox="0 0 1024 1024">
          <defs>
            <linearGradient id="intro-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#66c0f4" />
              <stop offset="1" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          {/* pathLength=100: el anillo "mide" 100, así el dibujado se anima con números simples. */}
          <circle
            className="intro-ring"
            cx="512"
            cy="512"
            r="300"
            pathLength={100}
            fill="none"
            stroke="url(#intro-grad)"
            strokeWidth="40"
            strokeLinecap="round"
            transform="rotate(-48 512 512)"
          />
          <g className="intro-orbit">
            <circle cx="580" cy="220" r="30" fill="#a78bfa" />
          </g>
          <path
            className="intro-play"
            d="M446 384 L446 640 L668 512 Z"
            fill="url(#intro-grad)"
            stroke="url(#intro-grad)"
            strokeWidth="64"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="intro-word">GAME HUB</div>
    </div>
  )
}

// Posiciones "al azar" pero FIJAS (generador con semilla): la intro se ve igual cada vez.
function makeParticles() {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 34 }, () => ({
    x: rand() * 100,
    y: 30 + rand() * 75,
    size: 2 + rand() * 4,
    delay: rand() * 1.2,
    duration: 3.5 + rand() * 3,
  }))
}
