// Interpretación de los archivos de Steam (funciones puras, sin tocar el disco).

import { getObject, getString, parseVdf } from './vdf.js'

// appids que Steam instala pero NO son juegos (librerías y runtimes).
const NOT_GAMES = new Set(['228980', '1070560', '1391110', '1628350', '1826330', '1493710'])
const NOT_GAME_NAMES = /^(proton|steam linux runtime|steamworks common)/i

// Bit 4 de StateFlags = "completamente instalado". 6 = 4 + 2 (instalado y con actualización pendiente).
const FULLY_INSTALLED = 4

export interface SteamApp {
  appid: string
  name: string
  installdir: string
  sizeBytes: number | null
  lastPlayed: Date | null
}

// libraryfolders.vdf -> rutas de TODAS las bibliotecas (podés tener juegos en varios discos).
export function parseLibraryFolders(text: string): string[] {
  const root = getObject(parseVdf(text), 'libraryfolders')
  if (!root) return []
  const paths: string[] = []
  for (const value of Object.values(root)) {
    if (typeof value !== 'object') continue
    const path = getString(value, 'path')
    if (path) paths.push(path)
  }
  return paths
}

// appmanifest_<appid>.acf -> datos del juego, o null si no es un juego instalado.
export function parseAppManifest(text: string): SteamApp | null {
  const state = getObject(parseVdf(text), 'AppState')
  if (!state) return null

  const appid = getString(state, 'appid')
  const name = getString(state, 'name')
  const installdir = getString(state, 'installdir')
  const flags = Number(getString(state, 'StateFlags') ?? '0')
  if (!appid || !name || !installdir) return null
  if ((flags & FULLY_INSTALLED) === 0) return null // descarga a medias
  if (NOT_GAMES.has(appid) || NOT_GAME_NAMES.test(name)) return null

  const size = Number(getString(state, 'SizeOnDisk'))
  const lastPlayed = Number(getString(state, 'LastPlayed')) // segundos Unix; "0" = nunca

  return {
    appid,
    name,
    installdir,
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
    lastPlayed: Number.isFinite(lastPlayed) && lastPlayed > 0 ? new Date(lastPlayed * 1000) : null,
  }
}
