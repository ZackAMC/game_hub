// Sonidos ORIGINALES, sintetizados en tiempo real con la Web Audio API. Cero archivos de audio.
//
// Conceptos:
// - AudioContext: el "estudio de grabación". Todo sonido es un grafo de nodos conectados.
// - OscillatorNode: genera una onda (sine = suave, triangle = un poco más brillante).
// - GainNode como ENVOLVENTE: sube rápido (attack) y se apaga (decay). Eso define si suena
//   como un "tic" corto o como una campana.
// - ConvolverNode: reverb. Le damos una "respuesta de impulso" hecha de ruido que se apaga
//   de a poco; eso simula una sala y da la sensación aireada de las interfaces de consola.

interface ToneOptions {
  freq: number
  type?: OscillatorType
  start?: number // segundos desde "ahora"
  attack?: number
  decay?: number
  gain?: number
  toFreq?: number // si se define, la nota se desliza hasta esta frecuencia
  bus?: GainNode // salida propia (ej: la intro), para poder apagarla toda junta
}

const MUTE_KEY = 'hub.muted'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private reverbSend: GainNode | null = null
  private muted = readMuted()

  isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      // sin almacenamiento: la preferencia dura solo esta sesión
    }
  }

  // --- La "paleta" de sonidos de la interfaz ---

  /** Moverse entre juegos: un "tic" agudo y suave. Variación mínima de tono para que no canse. */
  move(): void {
    const f = 1568 * (1 + (Math.random() - 0.5) * 0.015)
    this.tone({ freq: f, decay: 0.07, gain: 0.11 })
    this.tone({ freq: f * 2, decay: 0.035, gain: 0.025 })
  }

  /** Llegaste al borde de la lista: un golpe grave y corto, como "tope". */
  edge(): void {
    this.tone({ freq: 196, type: 'triangle', decay: 0.09, gain: 0.12 })
  }

  /** Cambiar de filtro o de opción: un clic mínimo. */
  tick(): void {
    this.tone({ freq: 2093, decay: 0.03, gain: 0.07 })
  }

  /** Confirmar algo: dos notas que suben (una quinta). */
  confirm(): void {
    this.tone({ freq: 880, type: 'triangle', decay: 0.16, gain: 0.13 })
    this.tone({ freq: 1318.5, start: 0.07, decay: 0.3, gain: 0.12 })
  }

  /** Volver o cancelar: dos notas que bajan. */
  back(): void {
    this.tone({ freq: 1174.7, decay: 0.1, gain: 0.1 })
    this.tone({ freq: 784, start: 0.06, decay: 0.18, gain: 0.09 })
  }

  /** Lanzar un juego: un arpegio brillante que se abre y queda flotando en la reverb. */
  launch(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // Do mayor, subiendo
    notes.forEach((freq, i) => this.tone({ freq, start: i * 0.055, attack: 0.015, decay: 1.2 - i * 0.12, gain: 0.08 }))
    this.tone({ freq: 261.63, type: 'triangle', attack: 0.08, decay: 1.4, gain: 0.06 }) // colchón grave
  }

  /** Algo salió mal: dos notas graves descendentes. */
  error(): void {
    this.tone({ freq: 330, type: 'triangle', decay: 0.14, gain: 0.13 })
    this.tone({ freq: 247, type: 'triangle', start: 0.11, decay: 0.22, gain: 0.13 })
  }

  /**
   * La intro: ~4 s sincronizados con la animación (ver Intro.tsx).
   * Todo pasa por un BUS propio con más reverb: suena "grande", como un encendido.
   * Devuelve una función que la apaga con un fundido corto (para cuando la salteás).
   */
  intro(): () => void {
    const silent = () => {}
    if (this.muted) return silent
    const ctx = this.ensureContext()
    if (!ctx || !this.master || !this.reverbSend) return silent

    const bus = ctx.createGain()
    bus.connect(this.master)
    const wet = ctx.createGain()
    wet.gain.value = 1.8 // más sala que los sonidos de la interfaz
    bus.connect(wet)
    wet.connect(this.reverbSend)
    const play = (o: ToneOptions) => this.tone({ ...o, bus })

    // 0 s: colchón grave que crece despacio (La y Mi: una quinta, abierta, sin "tristeza" ni "alegría").
    play({ freq: 110, attack: 1.2, decay: 2.8, gain: 0.07 })
    play({ freq: 164.81, attack: 1.4, decay: 2.6, gain: 0.05 })
    play({ freq: 220, type: 'triangle', attack: 1.6, decay: 2.2, gain: 0.025 })

    // 0.35–1.2 s: mientras se dibuja el anillo, un arpegio pentatónico que sube, como destellos.
    const shimmer = [880, 987.77, 1108.73, 1318.51, 1479.98, 1760]
    shimmer.forEach((freq, i) => play({ freq, start: 0.35 + i * 0.15, attack: 0.02, decay: 0.9, gain: 0.03 }))

    // 1.5 s: el punto aterriza -> campana.
    play({ freq: 2637, start: 1.5, attack: 0.005, decay: 1.6, gain: 0.04 })
    play({ freq: 1318.51, start: 1.5, attack: 0.005, decay: 1.2, gain: 0.04 })

    // 1.55 s: el play florece -> acorde amplio (La mayor con novena) que queda flotando.
    for (const freq of [440, 554.37, 659.25, 987.77]) {
      play({ freq, start: 1.55, attack: 0.25, decay: 2.4, gain: 0.045 })
    }
    play({ freq: 110, type: 'triangle', start: 1.55, attack: 0.3, decay: 2.2, gain: 0.05 })

    return () => {
      const t = ctx.currentTime
      bus.gain.cancelScheduledValues(t)
      bus.gain.setValueAtTime(bus.gain.value, t)
      bus.gain.linearRampToValueAtTime(0, t + 0.3)
    }
  }

  // --- Motor ---

  private tone({ freq, type = 'sine', start = 0, attack = 0.004, decay = 0.12, gain = 0.2, toFreq, bus }: ToneOptions): void {
    if (this.muted) return
    const ctx = this.ensureContext()
    if (!ctx || !this.master || !this.reverbSend) return

    const t0 = ctx.currentTime + start
    const end = t0 + attack + decay

    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, end)

    // Envolvente. Rampas EXPONENCIALES: el oído percibe el volumen en escala logarítmica,
    // así que suenan más naturales que las lineales. No pueden llegar a 0, por eso 0.0001.
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, end)

    osc.connect(env)
    if (bus) {
      env.connect(bus) // el bus decide cuánto va seco y cuánto a la reverb
    } else {
      env.connect(this.master) // señal "seca"
      env.connect(this.reverbSend) // y una parte va a la reverb
    }
    osc.start(t0)
    osc.stop(end + 0.05) // el nodo se libera solo al terminar
  }

  // El AudioContext se crea recién en el primer sonido (crearlo cuesta y no hace falta antes).
  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        const ctx = new AudioContext()
        const master = ctx.createGain()
        master.gain.value = 0.4
        master.connect(ctx.destination)

        const reverb = ctx.createConvolver()
        reverb.buffer = impulseResponse(ctx, 1.8, 3.2)
        const send = ctx.createGain()
        send.gain.value = 0.3
        send.connect(reverb)
        reverb.connect(master)

        this.ctx = ctx
        this.master = master
        this.reverbSend = send
      } catch {
        return null // sin audio disponible: la app sigue funcionando en silencio
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }
}

// "Sala" sintética: ruido estéreo que se apaga con una curva. Más segundos = sala más grande.
function impulseResponse(ctx: AudioContext, seconds: number, decayPower: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decayPower
  }
  return buffer
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

// Una sola instancia para toda la app: un solo AudioContext.
export const sounds = new SoundEngine()
