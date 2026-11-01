// INICIO CON WINDOWS: la app arranca con la PC, con la cortina RECOGIDA (--hidden).
//
// Windows guarda esto en HKCU\Software\Microsoft\Windows\CurrentVersion\Run. Solo tiene sentido
// en la app INSTALADA: en desarrollo, el ejecutable es electron.exe y registraríamos eso.
//
// Se activa sola la PRIMERA vez. Si después la apagás, se respeta: por eso hay un archivo-marca
// que dice "ya lo configuramos una vez", aunque hoy esté apagado.

import { app } from 'electron'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const HIDDEN_FLAG = '--hidden'
export const RUN_VALUE_NAME = 'GameHub' // el desinstalador borra este mismo nombre (build/installer.nsh)

const settings = { args: [HIDDEN_FLAG] }

export function autostartSupported(): boolean {
  return app.isPackaged
}

// executableWillLaunchAtLogin también mira si lo apagaste desde Configuración → Aplicaciones de inicio.
export function autostartEnabled(): boolean {
  return autostartSupported() && app.getLoginItemSettings(settings).executableWillLaunchAtLogin
}

export function setAutostart(enabled: boolean): void {
  if (!autostartSupported()) return
  app.setLoginItemSettings({ ...settings, openAtLogin: enabled, name: RUN_VALUE_NAME })
}

export async function enableAutostartOnFirstRun(): Promise<void> {
  if (!autostartSupported()) return
  const marker = join(app.getPath('userData'), 'autostart-configured')
  try {
    await access(marker)
    return // ya se configuró alguna vez: manda lo que eligió el usuario
  } catch {
    setAutostart(true)
    await writeFile(marker, new Date().toISOString())
  }
}
