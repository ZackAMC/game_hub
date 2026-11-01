// Tamaño total y cantidad de archivos de una carpeta (recursivo). Para mostrar QUÉ se va a borrar.

import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function folderStats(root: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0
  const pending = [root] // pila en vez de recursión: carpetas muy profundas no revientan el stack

  while (pending.length > 0) {
    const dir = pending.pop()!
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue // sin permiso: la salteamos, el número queda como estimación
    }
    for (const entry of entries) {
      // Junctions y symlinks NO se siguen: apuntan a otro lado y contaríamos de más (o en loop).
      if (entry.isSymbolicLink()) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) pending.push(path)
      else if (entry.isFile()) {
        try {
          bytes += (await lstat(path)).size
          files++
        } catch {
          // archivo bloqueado: se ignora
        }
      }
    }
  }
  return { bytes, files }
}
