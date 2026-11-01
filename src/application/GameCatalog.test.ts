import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Game, SourceId } from '../domain/Game.js'
import type { GameSource } from '../domain/ports/GameSource.js'
import { GameCatalog } from './GameCatalog.js'

function game(source: SourceId, nativeId: string, title: string, lastPlayed: Date | null = null): Game {
  return {
    id: `${source}:${nativeId}`,
    source,
    nativeId,
    title,
    installDir: 'X:\\',
    executable: null,
    sizeBytes: null,
    lastPlayed,
    playtime: null,
    coverPath: null,
    heroPath: null,
  }
}

// FAKE del puerto: devuelve juegos fijos y anota qué se lanzó.
class FakeSource implements GameSource {
  readonly launched: string[] = []
  constructor(
    readonly id: SourceId,
    private readonly games: Game[] | Error,
  ) {}
  async list(): Promise<Game[]> {
    if (this.games instanceof Error) throw this.games
    return this.games
  }
  async launch(g: Game): Promise<void> {
    this.launched.push(g.id)
  }
  async isRunning(): Promise<boolean> {
    return false
  }
}

test('junta todas las fuentes y ordena: recientes primero, después alfabético', async () => {
  const catalog = new GameCatalog([
    new FakeSource('steam', [game('steam', '1', 'Zelda-like'), game('steam', '2', 'Celeste', new Date(2026, 9, 1))]),
    new FakeSource('local', [game('local', 'a', 'Ánimo'), game('local', 'b', 'Hades', new Date(2026, 9, 20))]),
  ])
  const { games, errors } = await catalog.refresh()
  assert.deepEqual(games.map((g) => g.title), ['Hades', 'Celeste', 'Ánimo', 'Zelda-like'])
  assert.deepEqual(errors, [])
})

test('si una fuente falla, las demás siguen y el error queda reportado', async () => {
  const catalog = new GameCatalog([
    new FakeSource('steam', new Error('Steam no está instalado')),
    new FakeSource('local', [game('local', 'a', 'Hades')]),
  ])
  const { games, errors } = await catalog.refresh()
  assert.equal(games.length, 1)
  assert.deepEqual(errors, [{ source: 'steam', message: 'Steam no está instalado' }])
})

test('launch le pide el juego a SU fuente', async () => {
  const steam = new FakeSource('steam', [game('steam', '570', 'Dota 2')])
  const local = new FakeSource('local', [game('local', 'a', 'Hades')])
  const catalog = new GameCatalog([steam, local])
  await catalog.refresh()

  await catalog.launch('local:a')
  assert.deepEqual(local.launched, ['local:a'])
  assert.deepEqual(steam.launched, [])
})

test('launch rechaza ids que no están en la biblioteca', async () => {
  const catalog = new GameCatalog([new FakeSource('local', [])])
  await catalog.refresh()
  await assert.rejects(catalog.launch('local:inventado'), /no está en la biblioteca/)
})
