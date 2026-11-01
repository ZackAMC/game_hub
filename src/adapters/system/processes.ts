// ADAPTADOR DE SISTEMA: ¿hay un proceso corriendo desde una carpeta (o con cierto nombre)?
// Usa PowerShell porque es lo único que trae la RUTA de cada proceso sin instalar nada.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// SEGURIDAD: la carpeta y el nombre NO se pegan dentro del comando. Viajan como variables de
// entorno. Si una carpeta se llamara `x'; Remove-Item C:\ -Recurse; '`, pegarla en el script sería
// una inyección de comandos. Como variable, PowerShell la trata como texto y punto.
const SCRIPT = `
$dir = $env:GH_DIR
$name = $env:GH_NAME
@(Get-Process | Where-Object {
  ($_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase)) -or
  ($_.ProcessName -ieq $name)
}).Count
`

export async function isProcessRunning(folder: string, exeName: string): Promise<boolean> {
  // La barra final evita que "F:\Juegos\Hades" matchee "F:\Juegos\Hades II".
  const dir = folder.endsWith('\\') ? folder : `${folder}\\`
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
    env: { ...process.env, GH_DIR: dir, GH_NAME: exeName },
    windowsHide: true, // sin ventanita de consola parpadeando cada 3 segundos
    timeout: 8000,
  })
  return Number(stdout.trim()) > 0
}
