// Parser de VDF ("Valve Data Format" o KeyValues), el formato de texto de Steam.
// Se ve así:   "clave"  "valor"    o    "clave" { ...objeto anidado... }
// Es una función PURA (texto -> objeto), así que se testea sin tener Steam instalado.

export type VdfValue = string | VdfObject
export interface VdfObject {
  [key: string]: VdfValue
}

type Token = { type: 'string'; value: string } | { type: 'open' } | { type: 'close' }

export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text)
  let i = 0

  function parseObject(insideBraces: boolean): VdfObject {
    const obj: VdfObject = {}
    while (i < tokens.length) {
      const token = tokens[i++]!
      if (token.type === 'close') {
        if (!insideBraces) throw new Error('VDF inválido: "}" de más')
        return obj
      }
      if (token.type !== 'string') throw new Error('VDF inválido: se esperaba una clave')

      const next = tokens[i++]
      if (!next) throw new Error(`VDF inválido: la clave "${token.value}" no tiene valor`)
      if (next.type === 'open') obj[token.value] = parseObject(true)
      else if (next.type === 'string') obj[token.value] = next.value
      else throw new Error('VDF inválido: "}" inesperado')
    }
    if (insideBraces) throw new Error('VDF inválido: falta cerrar "}"')
    return obj
  }

  return parseObject(false)
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < text.length) {
    const ch = text[i]!

    if (/\s/.test(ch)) {
      i++
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++ // comentario hasta fin de línea
    } else if (ch === '{') {
      tokens.push({ type: 'open' })
      i++
    } else if (ch === '}') {
      tokens.push({ type: 'close' })
      i++
    } else if (ch === '"') {
      i++
      let value = ''
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length) {
          const esc = text[i + 1]!
          value += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc // "D:\\Steam" -> D:\Steam
          i += 2
        } else {
          value += text[i]
          i++
        }
      }
      i++ // comilla de cierre
      tokens.push({ type: 'string', value })
    } else {
      // Token sin comillas (poco común). Las condiciones tipo [$WIN32] se ignoran.
      let value = ''
      while (i < text.length && !/[\s{}"]/.test(text[i]!)) value += text[i++]
      if (!(value.startsWith('[') && value.endsWith(']'))) tokens.push({ type: 'string', value })
    }
  }
  return tokens
}

// Steam no es consistente con mayúsculas ("SizeOnDisk", "installdir"): buscamos sin distinguirlas.
export function getKey(obj: VdfObject, key: string): VdfValue | undefined {
  const wanted = key.toLowerCase()
  for (const [k, v] of Object.entries(obj)) if (k.toLowerCase() === wanted) return v
  return undefined
}

export function getString(obj: VdfObject, key: string): string | undefined {
  const v = getKey(obj, key)
  return typeof v === 'string' ? v : undefined
}

export function getObject(obj: VdfObject, key: string): VdfObject | undefined {
  const v = getKey(obj, key)
  return typeof v === 'object' ? v : undefined
}
