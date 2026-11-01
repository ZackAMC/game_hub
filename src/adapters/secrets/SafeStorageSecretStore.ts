// ADAPTADOR: guarda un secreto CIFRADO con safeStorage de Electron.
// En Windows usa DPAPI: el archivo solo lo puede descifrar TU usuario de Windows en ESTA PC.
// Si alguien copia el archivo a otra máquina, no le sirve.

import { safeStorage } from 'electron'
import { readFile, rm, writeFile } from 'node:fs/promises'
import type { SecretStore } from '../../domain/ports/SecretStore.js'

export class SafeStorageSecretStore implements SecretStore {
  constructor(private readonly filePath: string) {}

  async get(): Promise<string | null> {
    try {
      return safeStorage.decryptString(await readFile(this.filePath))
    } catch {
      return null // no existe, o se cifró con otro usuario: como si no hubiera key
    }
  }

  async set(value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('El cifrado del sistema no está disponible')
    await writeFile(this.filePath, safeStorage.encryptString(value))
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true })
  }
}
