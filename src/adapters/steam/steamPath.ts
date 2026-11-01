// Dónde está instalado Steam. Lo comparten SteamSource (juegos) y la detección de cuenta (logros).

import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Steam puede estar en cualquier disco (en tu PC está en D:\steam). La fuente de verdad es el registro.
export async function findSteamPath(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'])
    const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(stdout)
    if (match?.[1]) {
      const path = match[1].trim().replace(/\//g, '\\') // el registro la guarda como "d:/steam"
      if (await exists(path)) return path
    }
  } catch {
    // sin clave de registro: probamos la ruta por defecto
  }
  const fallback = 'C:\\Program Files (x86)\\Steam'
  return (await exists(fallback)) ? fallback : null
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
