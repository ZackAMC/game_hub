// Trae los logros del juego seleccionado, con dos cuidados:
// 1) DEBOUNCE: si pasás rápido por 10 juegos con las flechas, NO hacemos 10 pedidos.
//    Esperamos a que te quedes quieto un momento en uno.
// 2) Respuestas viejas: si llega tarde la respuesta de un juego que ya no está seleccionado, se descarta.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AchievementsDTO } from '../../shared/contract'

const DEBOUNCE_MS = 350

export function useAchievements(gameId: string | null, enabled: boolean) {
  const cache = useRef(new Map<string, AchievementsDTO>())
  const [data, setData] = useState<AchievementsDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0) // subirlo fuerza a volver a pedir (ej: después de cargar la key)

  useEffect(() => {
    if (!gameId || !enabled) {
      setData(null)
      setLoading(false)
      return
    }
    const cached = cache.current.get(gameId)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }

    setData(null)
    setLoading(true)
    let cancelled = false
    const timer = setTimeout(() => {
      window.hub.achievements(gameId).then(
        (result) => {
          if (result.status === 'ok' || result.status === 'none') cache.current.set(gameId, result)
          if (!cancelled) {
            setData(result)
            setLoading(false)
          }
        },
        (err: unknown) => {
          if (!cancelled) {
            setData({ status: 'error', message: err instanceof Error ? err.message : String(err) })
            setLoading(false)
          }
        },
      )
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gameId, enabled, version])

  const reload = useCallback(() => {
    cache.current.clear()
    setVersion((v) => v + 1)
  }, [])

  return { data, loading, reload }
}
