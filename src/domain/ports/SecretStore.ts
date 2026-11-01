// PUERTO: guardar UN secreto (la API key). Dónde y cómo se cifra es problema del adaptador.

export interface SecretStore {
  get(): Promise<string | null>
  set(value: string): Promise<void>
  clear(): Promise<void>
}
