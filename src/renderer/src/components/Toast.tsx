// Aviso flotante que se cierra solo.

import { useEffect } from 'react'

export interface ToastMessage {
  id: number // distinto en cada aviso: así el timer se reinicia aunque el texto se repita
  text: string
  kind: 'info' | 'success' | 'error'
}

export function Toast({ message, onDone }: { message: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onDone, message.kind === 'error' ? 6000 : 3000)
    return () => clearTimeout(timer)
  }, [message, onDone])

  if (!message) return null
  return (
    <div key={message.id} className={`toast ${message.kind}`} role="status">
      {message.text}
    </div>
  )
}
