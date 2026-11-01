// CASO DE USO: las horas que informan las tiendas, sin trabar la biblioteca.
//
// La biblioteca se refresca MUY seguido (cada vez que la ventana toma foco). Ir a la red
// en cada refresco sería lento y abusivo, así que:
//   - CACHÉ con vencimiento (ttl): dentro de ese tiempo, ni se pregunta.
//   - Un solo pedido en vuelo por tienda: diez refrescos seguidos = un pedido.
//   - Espera ACOTADA (waitMs): si la tienda tarda, se responde con lo último que sabíamos
//     y el pedido sigue en segundo plano para el próximo refresco.
//   - Si falla, se conservan los datos anteriores: mejor horas de hace 5 minutos que ninguna.

import { gameId, type SourceId } from '../domain/Game.js'
import type { StorePlaytime } from '../domain/Playtime.js'
import type { StorePlaytimeProvider } from '../domain/ports/StorePlaytimeProvider.js'

export interface StorePlaytimeServiceDeps {
  providers: StorePlaytimeProvider[]
  now: () => number
  sleep: (ms: number) => Promise<void>
  ttlMs?: number
  waitMs?: number
  onError?: (source: SourceId, error: unknown) => void
}

interface Entry {
  fetchedAt: number
  data: Map<string, StorePlaytime>
}

export class StorePlaytimeService {
  private readonly cache = new Map<SourceId, Entry>()
  private readonly inFlight = new Map<SourceId, Promise<void>>()
  private readonly ttlMs: number
  private readonly waitMs: number

  constructor(private readonly deps: StorePlaytimeServiceDeps) {
    this.ttlMs = deps.ttlMs ?? 5 * 60_000
    this.waitMs = deps.waitMs ?? 3_000
  }

  // Clave: id del hub ("steam:570"). Nunca lanza: las horas son un extra, no pueden romper la biblioteca.
  async all(): Promise<Map<string, StorePlaytime>> {
    await Promise.all(this.deps.providers.map((p) => this.refreshIfStale(p)))
    const result = new Map<string, StorePlaytime>()
    for (const [source, entry] of this.cache) {
      for (const [nativeId, playtime] of entry.data) result.set(gameId(source, nativeId), playtime)
    }
    return result
  }

  // Los datos viejos se siguen mostrando hasta que llegan los nuevos; solo se fuerza el próximo pedido.
  invalidate(source?: SourceId): void {
    for (const [key, entry] of this.cache) {
      if (!source || key === source) entry.fetchedAt = Number.NEGATIVE_INFINITY
    }
  }

  private async refreshIfStale(provider: StorePlaytimeProvider): Promise<void> {
    const entry = this.cache.get(provider.source)
    if (entry && this.deps.now() - entry.fetchedAt < this.ttlMs) return

    let job = this.inFlight.get(provider.source)
    if (!job) {
      job = provider
        .fetchAll()
        .then((data) => {
          this.cache.set(provider.source, { fetchedAt: this.deps.now(), data })
        })
        .catch((error: unknown) => {
          this.deps.onError?.(provider.source, error)
          // No reintentar en cada refresco: se espera un ttl entero, con los datos que ya había.
          this.cache.set(provider.source, { fetchedAt: this.deps.now(), data: entry?.data ?? new Map() })
        })
        .finally(() => this.inFlight.delete(provider.source))
      this.inFlight.set(provider.source, job)
    }
    await Promise.race([job, this.deps.sleep(this.waitMs)])
  }
}
