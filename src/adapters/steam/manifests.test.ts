import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVdf } from './vdf.js'
import { parseAppManifest, parseLibraryFolders } from './manifests.js'

// Muestras con el MISMO formato que los archivos reales de Steam (tabs, barras escapadas).
const LIBRARY_FOLDERS = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"D:\\\\Steam"
\t\t"apps"
\t\t{
\t\t\t"228980"\t\t"132691472"
\t\t}
\t}
\t"1"
\t{
\t\t"path"\t\t"C:\\\\SteamLibrary"
\t}
}`

function manifest(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `\t"${k}"\t\t"${v}"`)
  return `"AppState"\n{\n${lines.join('\n')}\n}`
}

test('parseVdf entiende objetos anidados, escapes y comentarios', () => {
  const obj = parseVdf('// comentario\n"a" { "b" "x\\\\y" "c" { "d" "1" } }')
  assert.deepEqual(obj, { a: { b: 'x\\y', c: { d: '1' } } })
})

test('parseVdf rechaza llaves sin cerrar', () => {
  assert.throws(() => parseVdf('"a" { "b" "1"'), /falta cerrar/)
})

test('parseLibraryFolders devuelve todas las bibliotecas con rutas de Windows', () => {
  assert.deepEqual(parseLibraryFolders(LIBRARY_FOLDERS), ['D:\\Steam', 'C:\\SteamLibrary'])
})

test('parseAppManifest lee un juego instalado', () => {
  const app = parseAppManifest(
    manifest({
      appid: '339340',
      name: 'Resident Evil 0',
      StateFlags: '4',
      installdir: 'Resident Evil 0',
      LastPlayed: '1791855340',
      SizeOnDisk: '12404306165',
    }),
  )
  assert.equal(app?.name, 'Resident Evil 0')
  assert.equal(app?.sizeBytes, 12404306165)
  assert.equal(app?.lastPlayed?.getTime(), 1791855340 * 1000)
})

test('StateFlags se mira por BIT: 6 (instalado + update pendiente) también cuenta', () => {
  const app = parseAppManifest(manifest({ appid: '1366540', name: 'Dyson Sphere Program', StateFlags: '6', installdir: 'DSP' }))
  assert.equal(app?.name, 'Dyson Sphere Program')
})

test('descarta descargas a medias, redistribuibles y Proton', () => {
  assert.equal(parseAppManifest(manifest({ appid: '1', name: 'A medias', StateFlags: '1026', installdir: 'x' })), null)
  assert.equal(parseAppManifest(manifest({ appid: '228980', name: 'Steamworks Common Redistributables', StateFlags: '4', installdir: 'x' })), null)
  assert.equal(parseAppManifest(manifest({ appid: '9999999', name: 'Proton 9.0', StateFlags: '4', installdir: 'x' })), null)
})

test('LastPlayed "0" significa nunca jugado', () => {
  const app = parseAppManifest(manifest({ appid: '5', name: 'Nuevo', StateFlags: '4', installdir: 'x', LastPlayed: '0' }))
  assert.equal(app?.lastPlayed, null)
})
