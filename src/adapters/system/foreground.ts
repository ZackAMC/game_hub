// ADAPTADOR (Windows): traer una ventana al frente AUNQUE Windows no quiera.
//
// Windows tiene un "bloqueo de primer plano": solo puede tomar el foco la app que recibió la
// última entrada del usuario. El atajo de teclado cuenta como entrada; el botón PS del mando NO.
// Sin esto, la cortina baja pero sin foco, y la barra de tareas queda encima.
//
// La técnica estándar: "engancharse" un instante a la cola de entrada del hilo que tiene el foco
// (AttachThreadInput). Compartiendo esa cola, Windows nos deja tomar el primer plano. Después
// nos desenganchamos. koffi permite llamar a user32.dll sin compilar código nativo.

import koffi from 'koffi'

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')

// HWND es un puntero: lo tratamos como un entero del tamaño de un puntero (intptr).
const GetForegroundWindow = user32.func('intptr __stdcall GetForegroundWindow()')
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(intptr hWnd, void *lpdwProcessId)')
const AttachThreadInput = user32.func('bool __stdcall AttachThreadInput(uint32 idAttach, uint32 idAttachTo, bool fAttach)')
const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(intptr hWnd)')
const BringWindowToTop = user32.func('bool __stdcall BringWindowToTop(intptr hWnd)')
const GetCurrentThreadId = kernel32.func('uint32 __stdcall GetCurrentThreadId()')

// nativeHandle: lo que devuelve BrowserWindow.getNativeWindowHandle() (el HWND en un Buffer).
export function forceForeground(nativeHandle: Buffer): boolean {
  const hwnd = nativeHandle.readBigUInt64LE(0)
  const foreground = GetForegroundWindow() as bigint | number
  const ours = GetCurrentThreadId() as number
  const theirs = foreground ? (GetWindowThreadProcessId(foreground, null) as number) : 0

  const attach = theirs !== 0 && theirs !== ours
  if (attach) AttachThreadInput(ours, theirs, true)
  try {
    BringWindowToTop(hwnd)
    return SetForegroundWindow(hwnd) as boolean
  } finally {
    if (attach) AttachThreadInput(ours, theirs, false) // SIEMPRE desengancharse, pase lo que pase
  }
}
