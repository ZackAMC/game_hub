// REGLA DE NEGOCIO: ¿es seguro mandar ESTA carpeta a la Papelera para desinstalar un juego local?
//
// La "carpeta del juego" es donde está el .exe. Si el .exe estaba suelto en Descargas,
// "desinstalar" se llevaría TODA tu carpeta de Descargas. Esta regla existe para que eso no pase nunca.
// Main la aplica SIEMPRE antes de borrar, diga lo que diga la UI.

export type GuardResult = { allowed: true } | { allowed: false; reason: string }

const PERSONAL = ['desktop', 'downloads', 'documents', 'pictures', 'videos', 'music', 'saved games', 'appdata', 'escritorio', 'descargas', 'documentos']

export function checkUninstallFolder(folder: string, otherGameFolders: string[], userHome: string): GuardResult {
  const dir = normalize(folder)
  const home = normalize(userHome)

  if (/^[a-z]:$/.test(dir)) return block('Es la raíz de un disco.')

  if (/^[a-z]:\\(windows|program files|program files \(x86\)|programdata|users)$/.test(dir) || /^[a-z]:\\windows\\/.test(dir)) {
    return block('Es una carpeta del sistema.')
  }

  if (dir === home) return block('Es tu carpeta de usuario.')
  if (dir.startsWith(`${home}\\`)) {
    const rest = dir.slice(home.length + 1) // "downloads", "downloads\hades", "onedrive - personal"…
    const isTopLevel = !rest.includes('\\') // solo la carpeta personal en sí, no lo que hay adentro
    if (isTopLevel && (PERSONAL.includes(rest) || rest.startsWith('onedrive'))) {
      return block('Es una carpeta personal (Escritorio, Descargas, Documentos…). El .exe está suelto ahí: borralo a mano.')
    }
  }

  if (/\\steamapps(\\common)?$/.test(dir)) return block('Es una carpeta de biblioteca de Steam.')

  // Contiene (o ES) la carpeta de otro juego de la biblioteca.
  const others = otherGameFolders.map(normalize).filter((other) => other === dir || other.startsWith(`${dir}\\`))
  if (others.length > 0) return block('Contiene otros juegos de tu biblioteca. Desinstalarla también los borraría.')

  return { allowed: true }
}

// Windows no distingue mayúsculas, acepta "/" y "\" y la barra final no cambia nada.
function normalize(path: string): string {
  const p = path.replace(/\//g, '\\').toLowerCase()
  return p.length > 3 ? p.replace(/\\+$/, '') : p.replace(/\\$/, '')
}

function block(reason: string): GuardResult {
  return { allowed: false, reason }
}
