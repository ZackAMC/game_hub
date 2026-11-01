import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkUninstallFolder } from './UninstallGuard.js'

const HOME = 'C:\\Users\\andre'
const allowed = (folder: string, others: string[] = []) => checkUninstallFolder(folder, others, HOME).allowed

test('permite una carpeta normal de juego', () => {
  assert.equal(allowed('F:\\Juegos\\Hades'), true)
  assert.equal(allowed('C:\\Program Files\\Mi Juego'), true)
  assert.equal(allowed('C:\\Users\\andre\\Games\\Celeste'), true)
})

test('bloquea raíces de disco y carpetas del sistema', () => {
  assert.equal(allowed('F:\\'), false)
  assert.equal(allowed('F:'), false)
  assert.equal(allowed('C:\\Windows'), false)
  assert.equal(allowed('C:\\Windows\\System32'), false)
  assert.equal(allowed('C:\\Program Files'), false)
  assert.equal(allowed('C:\\Users'), false)
})

test('bloquea tu perfil y las carpetas personales (el .exe suelto en Descargas)', () => {
  assert.equal(allowed('C:\\Users\\andre'), false)
  assert.equal(allowed('C:\\Users\\andre\\Downloads'), false)
  assert.equal(allowed('c:/users/ANDRE/desktop/'), false) // mayúsculas, barras y barra final no importan
  assert.equal(allowed('C:\\Users\\andre\\OneDrive - Personal'), false)
  assert.equal(allowed('C:\\Users\\andre\\AppData'), false)
  // pero una carpeta DENTRO de Descargas sí es una carpeta de juego normal
  assert.equal(allowed('C:\\Users\\andre\\Downloads\\Hades'), true)
})

test('bloquea carpetas de bibliotecas de Steam', () => {
  assert.equal(allowed('C:\\SteamLibrary\\steamapps\\common'), false)
  assert.equal(allowed('D:\\Steam\\steamapps'), false)
})

test('bloquea si la carpeta contiene otros juegos de la biblioteca', () => {
  const result = checkUninstallFolder('F:\\Juegos', ['F:\\Juegos\\Hades', 'G:\\Otro'], HOME)
  assert.equal(result.allowed, false)
  if (!result.allowed) assert.match(result.reason, /otros juegos/)
  // carpetas hermanas con prefijo parecido NO cuentan
  assert.equal(allowed('F:\\Juegos\\Hades', ['F:\\Juegos\\Hades II']), true)
  // dos juegos en la MISMA carpeta: borrar uno se llevaría al otro
  assert.equal(allowed('F:\\Juegos\\Pack', ['F:\\Juegos\\Pack']), false)
})
