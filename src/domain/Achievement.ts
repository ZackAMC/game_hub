// DOMINIO: un logro, venga de la tienda que venga.

export interface Achievement {
  id: string
  name: string
  description: string | null
  hidden: boolean // logro "secreto": no mostramos su descripción hasta desbloquearlo
  unlocked: boolean
  unlockedAt: Date | null
  iconUrl: string | null
  iconLockedUrl: string | null // versión en gris
  globalPercent: number | null // % de jugadores que lo tienen: mide la rareza
}

// Orden útil: primero lo último que desbloqueaste; después lo bloqueado, del más común
// (lo más fácil de conseguir) al más raro.
export function sortAchievements(list: Achievement[]): Achievement[] {
  return [...list].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
    if (a.unlocked) return (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0)
    return (b.globalPercent ?? -1) - (a.globalPercent ?? -1)
  })
}

// Errores con SIGNIFICADO de negocio: el caso de uso decide qué hacer con cada uno.
export class AchievementsNotConfiguredError extends Error {
  constructor() {
    super('Falta conectar la cuenta para ver logros')
    this.name = 'AchievementsNotConfiguredError'
  }
}
