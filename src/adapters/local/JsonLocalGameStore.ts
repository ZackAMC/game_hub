// ADAPTADOR: guarda los juegos locales en un archivo JSON.

import { readFile, rename, writeFile } from 'node:fs/promises'
import type { LocalGameRecord, LocalGameStore } from '../../domain/ports/LocalGameStore.js'

export class JsonLocalGameStore implements LocalGameStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<LocalGameRecord[]> {
    try {
      const data: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      return Array.isArray(data) ? (data as LocalGameRecord[]) : []
    } catch (err) {
      if (isNotFound(err)) return [] // primera vez: todavía no hay archivo
      throw err
    }
  }

  async save(records: LocalGameRecord[]): Promise<void> {
    // Escritura ATÓMICA: primero a un temporal y después renombrar.
    // Si la PC se apaga a mitad de camino (y la tuya tuvo apagados raros), el JSON viejo queda intacto.
    const tmp = `${this.filePath}.tmp`
    await writeFile(tmp, JSON.stringify(records, null, 2), 'utf8')
    await rename(tmp, this.filePath)
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT'
}
