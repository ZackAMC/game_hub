import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSearch, SteamStoreArtwork } from './SteamStoreArtwork.js'

test('parseSearch se queda solo con juegos y arma la miniatura', () => {
  const candidates = parseSearch({
    items: [
      { type: 'app', id: 367520, name: 'Hollow Knight' },
      { type: 'sub', id: 1, name: 'Un paquete' },
      { type: 'app', id: 1030300, name: 'Hollow Knight: Silksong' },
    ],
  })
  assert.deepEqual(
    candidates.map((c) => c.id),
    ['steam:367520', 'steam:1030300'],
  )
  assert.match(candidates[0]!.thumbUrl!, /\/367520\/library_600x900\.jpg$/)
})

test('parseSearch tolera respuestas raras', () => {
  assert.deepEqual(parseSearch(null), [])
  assert.deepEqual(parseSearch({ items: 'no' }), [])
})

test('download prueba alternativas hasta encontrar una portada', async () => {
  const requested: string[] = []
  const store = new SteamStoreArtwork({
    fetchJson: async () => ({ ok: true, body: null }),
    fetchImage: async (url) => {
      requested.push(url)
      return url.endsWith('/header.jpg') ? new Uint8Array([7]) : null // solo existe el header
    },
  })
  const images = await store.download('steam:42')
  assert.deepEqual(images.cover, new Uint8Array([7]))
  assert.equal(images.hero, null)
  assert.ok(requested.some((u) => u.endsWith('library_600x900_2x.jpg')))
})

test('download rechaza ids que no son de Steam (no arma URLs con texto arbitrario)', async () => {
  const store = new SteamStoreArtwork({ fetchJson: async () => ({ ok: true, body: null }), fetchImage: async () => null })
  await assert.rejects(store.download('steam:../../etc'), /inválido/)
})
