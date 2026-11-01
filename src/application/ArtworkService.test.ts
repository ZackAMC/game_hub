import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Game } from '../domain/Game.js'
import type { ArtworkProvider } from '../domain/ports/ArtworkProvider.js'
import type { ArtworkKind, ArtworkStore } from '../domain/ports/ArtworkStore.js'
import { ArtworkService, cleanSearchTerm, type ArtworkPatch } from './ArtworkService.js'

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'local:a',
    source: 'local',
    nativeId: 'a',
    title: 'Hollow Knight',
    installDir: 'F:\\Juegos\\HK',
    executable: 'F:\\Juegos\\HK\\hk.exe',
    sizeBytes: null,
    lastPlayed: null,
    playtime: null,
    coverPath: null,
    heroPath: null,
    ...overrides,
  }
}

class FakeStore implements ArtworkStore {
  saved: string[] = []
  removed: string[] = []
  async saveBytes(key: string, kind: ArtworkKind) {
    const path = `ART\\${key}-${kind}-${this.saved.length}.jpg`
    this.saved.push(path)
    return path
  }
  async copyFile(key: string, kind: ArtworkKind) {
    return this.saveBytes(key, kind)
  }
  async removeOwned(path: string) {
    this.removed.push(path)
  }
}

function setup(g: Game, provider?: Partial<ArtworkProvider>) {
  const store = new FakeStore()
  const patches: ArtworkPatch[] = []
  const fullProvider: ArtworkProvider = {
    supports: (id) => id.startsWith('steam:'),
    search: async () => [{ id: 'steam:1', title: 'Hollow Knight', thumbUrl: null, sourceLabel: 'Steam' }],
    download: async () => ({ cover: new Uint8Array([1]), hero: new Uint8Array([2]) }),
    ...provider,
  }
  const service = new ArtworkService({
    findGame: (id) => (id === g.id ? g : undefined),
    providers: [fullProvider],
    store,
    setArtwork: async (_id, patch) => {
      patches.push(patch)
    },
  })
  return { service, store, patches }
}

test('aplicar un resultado guarda portada y fondo, y borra las imágenes viejas', async () => {
  const { service, store, patches } = setup(game({ coverPath: 'ART\\old-cover.jpg', heroPath: 'ART\\old-hero.jpg' }))
  await service.applyCandidate('local:a', 'steam:1')
  assert.deepEqual(patches, [{ coverPath: 'ART\\a-cover-0.jpg', heroPath: 'ART\\a-hero-1.jpg' }])
  assert.deepEqual(store.removed, ['ART\\old-cover.jpg', 'ART\\old-hero.jpg'])
})

test('si el resultado no tiene fondo, conserva el fondo que ya había', async () => {
  const { service, store, patches } = setup(game({ heroPath: 'ART\\mio.jpg' }), {
    download: async () => ({ cover: new Uint8Array([1]), hero: null }),
  })
  await service.applyCandidate('local:a', 'steam:1')
  assert.deepEqual(patches, [{ coverPath: 'ART\\a-cover-0.jpg', heroPath: 'ART\\mio.jpg' }])
  assert.deepEqual(store.removed, [])
})

test('rechaza resultados sin imágenes y juegos que no son locales', async () => {
  const empty = setup(game(), { download: async () => ({ cover: null, hero: null }) })
  await assert.rejects(empty.service.applyCandidate('local:a', 'steam:1'), /no tiene imágenes/)

  const steamGame = setup(game({ id: 'steam:9', source: 'steam' }))
  await assert.rejects(steamGame.service.applyCandidate('steam:9', 'steam:1'), /juegos locales/)
})

test('rechaza ids de resultado que ningún proveedor reconoce', async () => {
  const { service } = setup(game())
  await assert.rejects(service.applyCandidate('local:a', 'otro:1'), /inválido/)
})

test('elegir un archivo reemplaza solo ese tipo de imagen', async () => {
  const { service, store, patches } = setup(game({ coverPath: 'ART\\old.jpg', heroPath: 'ART\\hero.jpg' }))
  await service.applyFile('local:a', 'cover', 'C:\\Users\\yo\\portada.png')
  assert.deepEqual(patches, [{ coverPath: 'ART\\a-cover-0.jpg' }])
  assert.deepEqual(store.removed, ['ART\\old.jpg'])
})

test('clear quita ambas imágenes', async () => {
  const { service, store, patches } = setup(game({ coverPath: 'ART\\c.jpg', heroPath: 'ART\\h.jpg' }))
  await service.clear('local:a')
  assert.deepEqual(patches, [{ coverPath: null, heroPath: null }])
  assert.deepEqual(store.removed, ['ART\\c.jpg', 'ART\\h.jpg'])
})

test('cleanSearchTerm saca ruido de nombres de carpeta', () => {
  assert.equal(cleanSearchTerm('Hollow_Knight [v1.5.78] (Repack)'), 'Hollow Knight')
  assert.equal(cleanSearchTerm('Celeste.v1.4.0.0'), 'Celeste')
  assert.equal(cleanSearchTerm('Hades'), 'Hades')
  assert.equal(cleanSearchTerm('   '), '')
})
