import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LocalGameRecord, LocalGameStore } from '../../domain/ports/LocalGameStore.js'
import { guessTitle, LocalSource } from './LocalSource.js'

class MemoryStore implements LocalGameStore {
  records: LocalGameRecord[] = []
  async load() {
    return structuredClone(this.records)
  }
  async save(records: LocalGameRecord[]) {
    this.records = structuredClone(records)
  }
}

function setup() {
  const store = new MemoryStore()
  const spawned: string[] = []
  // Set mutable: los tests pueden "borrar" archivos. Comparación sin mayúsculas, como Windows.
  const existing = new Set(['f:\\juegos\\hades\\hades.exe'])
  const running: string[] = []
  const trashed: string[] = []
  let n = 0
  const source = new LocalSource({
    store,
    spawnGame: async (exe) => {
      spawned.push(exe)
    },
    fileExists: async (p) => existing.has(p.toLowerCase()),
    isProcessRunning: async (folder, exeName) => {
      running.push(`${folder}|${exeName}`)
      return true
    },
    trash: async (path) => {
      trashed.push(path)
    },
    folderStats: async () => ({ bytes: 1234, files: 5 }),
    userHome: 'C:\\Users\\yo',
    newId: () => `id${++n}`,
    now: () => new Date('2026-11-01T12:00:00Z'),
  })
  return { store, spawned, source, existing, running, trashed }
}

test('desinstalar manda la carpeta a la Papelera y saca el juego de la biblioteca', async () => {
  const { source, trashed } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  const [game] = await source.list()
  assert.deepEqual(await source.previewUninstall(game!), { allowed: true, folder: 'F:\\Juegos\\Hades', bytes: 1234, files: 5 })
  assert.equal(await source.uninstall(game!), 'removed')
  assert.deepEqual(trashed, ['F:\\Juegos\\Hades'])
  assert.deepEqual(await source.list(), [])
})

test('NO desinstala una carpeta que contiene otro juego de la biblioteca', async () => {
  const { source, trashed, existing } = setup()
  existing.add('f:\\juegos\\launcher.exe')
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  await source.add('F:\\Juegos\\launcher.exe') // su carpeta es F:\Juegos, que contiene a Hades
  const launcher = (await source.list()).find((g) => g.executable === 'F:\\Juegos\\launcher.exe')!
  const preview = await source.previewUninstall(launcher)
  assert.equal(preview.allowed, false)
  // aunque la UI ignorara el preview, uninstall vuelve a chequear y se niega
  await assert.rejects(source.uninstall(launcher), /otros juegos/)
  assert.deepEqual(trashed, [])
})

test('isRunning pregunta por la CARPETA del juego y el nombre del .exe (sin extensión)', async () => {
  const { source, running } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  const [game] = await source.list()
  assert.equal(await source.isRunning(game!), true)
  assert.deepEqual(running, ['F:\\Juegos\\Hades|Hades'])
})

test('recordSession guarda cada sesión con su inicio y duración', async () => {
  const { source } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  await source.recordSession('id1', new Date('2026-10-30T20:00:00Z'), 60_000)
  await source.recordSession('id1', new Date('2026-10-31T21:00:00Z'), 30_000)
  const [game] = await source.list()
  assert.deepEqual(
    game?.playtime?.sessions.map((s) => [s.startedAt.toISOString(), s.durationMs]),
    [
      ['2026-10-30T20:00:00.000Z', 60_000],
      ['2026-10-31T21:00:00.000Z', 30_000],
    ],
  )
})

test('el tiempo cargado a mano se guarda aparte y se valida', async () => {
  const { source } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  await source.setManualPlaytime('id1', 50 * 3_600_000)
  const [game] = await source.list()
  assert.equal(game?.playtime?.manualMs, 50 * 3_600_000)
  assert.deepEqual(game?.playtime?.sessions, [])
  await assert.rejects(source.setManualPlaytime('id1', -5), /inválido/)
})

test('un JSON viejo con solo "playtimeMs" se respeta como tiempo legado', async () => {
  const { source, store } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  store.records[0]!.playtimeMs = 7_200_000 // como lo guardaba la versión anterior
  const [game] = await source.list()
  assert.equal(game?.playtime?.legacyMs, 7_200_000)
})

test('agrega un .exe y adivina el título por la carpeta', async () => {
  const { source } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  const [game] = await source.list()
  assert.equal(game?.id, 'local:id1')
  assert.equal(game?.title, 'Hades')
  assert.equal(game?.installDir, 'F:\\Juegos\\Hades')
})

test('rechaza archivos que no son .exe, que no existen o que ya están', async () => {
  const { source } = setup()
  await assert.rejects(source.add('F:\\Juegos\\Hades\\readme.txt'), /\.exe/)
  await assert.rejects(source.add('F:\\no\\existe.exe'), /no existe/)
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  await assert.rejects(source.add('f:\\juegos\\hades\\HADES.EXE'), /ya está/)
})

test('lanzar ejecuta el .exe y registra cuándo se jugó', async () => {
  const { source, spawned } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  const [game] = await source.list()
  await source.launch(game!)
  assert.deepEqual(spawned, ['F:\\Juegos\\Hades\\Hades.exe'])
  const [after] = await source.list()
  assert.equal(after?.lastPlayed?.toISOString(), '2026-11-01T12:00:00.000Z')
})

test('no lanza si el ejecutable desapareció', async () => {
  const { source, spawned, existing } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  const [game] = await source.list()
  existing.clear() // el usuario borró la carpeta del juego
  await assert.rejects(source.launch(game!), /ya no existe/)
  assert.deepEqual(spawned, [])
})

test('remove saca el juego de la biblioteca', async () => {
  const { source } = setup()
  await source.add('F:\\Juegos\\Hades\\Hades.exe')
  await source.remove('id1')
  assert.deepEqual(await source.list(), [])
})

test('guessTitle limpia guiones bajos y puntos', () => {
  assert.equal(guessTitle('F:\\Juegos\\Hollow_Knight\\hollow_knight.exe'), 'Hollow Knight')
  assert.equal(guessTitle('F:\\juego.exe'), 'juego')
})
