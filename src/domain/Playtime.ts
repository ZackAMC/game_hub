// DOMINIO: tiempo de juego.
// Guardamos el DATO CRUDO (cada sesión) y CALCULAMOS los resúmenes. Si mañana querés
// "horas por mes" o un gráfico, no hace falta migrar nada: las sesiones ya están.

export interface PlaySession {
  startedAt: Date
  durationMs: number
}

export interface PlaytimeRecord {
  sessions: PlaySession[] // medidas por el hub
  manualMs: number // cargado a mano: "ya tenía X horas antes de usar el hub"
  legacyMs: number // medido por una versión anterior que solo guardaba el total (sin detalle)
}

export interface PlaytimeSummary {
  totalMs: number
  measuredMs: number // lo que midió el hub (sesiones + legado)
  manualMs: number // lo que cargaste vos: se muestra APARTE para saber qué es estimado
  weekMs: number
  monthMs: number
  lastSession: PlaySession | null
}

export function summarizePlaytime(record: PlaytimeRecord, now: Date): PlaytimeSummary {
  const measuredSessions = record.sessions.reduce((acc, s) => acc + s.durationMs, 0)
  const measuredMs = measuredSessions + record.legacyMs
  const lastSession = record.sessions.reduce<PlaySession | null>(
    (latest, s) => (!latest || s.startedAt > latest.startedAt ? s : latest),
    null,
  )
  return {
    totalMs: measuredMs + record.manualMs,
    measuredMs,
    manualMs: record.manualMs,
    weekMs: sumSince(record.sessions, startOfWeek(now), now),
    monthMs: sumSince(record.sessions, startOfMonth(now), now),
    lastSession,
  }
}

// La semana empieza el LUNES a las 00:00, hora local.
export function startOfWeek(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const daysSinceMonday = (d.getDay() + 6) % 7 // getDay(): 0 = domingo
  d.setDate(d.getDate() - daysSinceMonday)
  return d
}

export function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

// Cuenta SOLO la parte de cada sesión que cae dentro del período.
// Domingo 23:00 a lunes 01:00 -> para "esta semana" suma 1 hora, no 2.
function sumSince(sessions: PlaySession[], from: Date, now: Date): number {
  return sessions.reduce((acc, s) => {
    const start = s.startedAt.getTime()
    const end = start + s.durationMs
    return acc + Math.max(0, Math.min(end, now.getTime()) - Math.max(start, from.getTime()))
  }, 0)
}
