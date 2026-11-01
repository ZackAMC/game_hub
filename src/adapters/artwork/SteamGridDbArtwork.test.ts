import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SteamGridDbArtwork } from './SteamGridDbArtwork.js'

type Call = { url: string; headers?: Record<string, string> }

function setup(key: string | null, routes: Record<string, unknown>) {
  const calls: Call[] = []
  const images: string[] = []
  const sgdb = new SteamGridDbArtwork({
    getApiKey: async () => key,
    fetchJson: async (url, headers) => {
      calls.push({ url, headers })
      const match = Object.keys(routes).find((r) => url.includes(r))
      return match ? { ok: true, status: 200, body: routes[match] } : { ok: false, status: 404, body: null }
    },
    fetchImage: async (url) => {
      images.push(url)
      return new Uint8Array([url.length])
    },
  })
  return { sgdb, calls, images }
}

const GOW3 = { id: 5, name: 'God of War III', release_date: 1268611200 } // marzo 2010

test('sin key no hace pedidos y no aporta resultados', async () => {
  const { sgdb, calls } = setup(null, {})
  assert.deepEqual(await sgdb.search('god of war'), [])
  assert.equal(calls.length, 0)
})

test('busca, agrega el año y trae una miniatura por resultado', async () => {
  const { sgdb, calls } = setup('KEY', {
    '/search/autocomplete/': { success: true, data: [GOW3, { id: 6, name: 'Bloodborne' }] },
    '/grids/game/5': { success: true, data: [{ url: 'https://cdn/g5.png', thumb: 'https://cdn/g5_thumb.png' }] },
    '/grids/game/6': { success: true, data: [] },
  })
  const results = await sgdb.search('god of war iii')
  assert.deepEqual(results, [
    { id: 'sgdb:5', title: 'God of War III (2010)', thumbUrl: 'https://cdn/g5_thumb.png', sourceLabel: 'SteamGridDB' },
    { id: 'sgdb:6', title: 'Bloodborne', thumbUrl: null, sourceLabel: 'SteamGridDB' },
  ])
  // La key viaja en el HEADER, nunca en la URL (las URLs terminan en logs e historiales).
  assert.ok(calls.every((c) => c.headers?.Authorization === 'Bearer KEY' && !c.url.includes('KEY')))
  // Solo portadas verticales y sin contenido NSFW.
  const gridCall = calls.find((c) => c.url.includes('/grids/'))!
  assert.match(gridCall.url, /dimensions=600x900/)
  assert.match(gridCall.url, /nsfw=false/)
})

test('download baja la primera portada y el primer fondo', async () => {
  const { sgdb, images } = setup('KEY', {
    '/grids/game/5': { data: [{ url: 'https://cdn/cover1.png' }, { url: 'https://cdn/cover2.png' }] },
    '/heroes/game/5': { data: [{ url: 'https://cdn/hero1.png' }] },
  })
  const result = await sgdb.download('sgdb:5')
  assert.ok(result.cover && result.hero)
  assert.deepEqual(images.sort(), ['https://cdn/cover1.png', 'https://cdn/hero1.png'])
})

test('si no hay fondo, devuelve solo la portada', async () => {
  const { sgdb } = setup('KEY', { '/grids/game/5': { data: [{ url: 'https://cdn/c.png' }] }, '/heroes/game/5': { data: [] } })
  const result = await sgdb.download('sgdb:5')
  assert.ok(result.cover)
  assert.equal(result.hero, null)
})

test('rechaza ids que no son de SteamGridDB', async () => {
  const { sgdb } = setup('KEY', {})
  assert.equal(sgdb.supports('steam:5'), false)
  await assert.rejects(sgdb.download('sgdb:abc'), /inválido/)
})
