// Utilidades compartidas por los adaptadores de la Steam Web API.

const API = 'https://api.steampowered.com'

export function steamApiUrl(path: string, params: Record<string, string>): string {
  return `${API}/${path}/?${new URLSearchParams(params).toString()}`
}

// Navega un JSON desconocido sin explotar si falta un nivel. Devuelve undefined si algo no está.
export function readPath<T>(value: unknown, path: string[]): T | undefined {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current as T | undefined
}
