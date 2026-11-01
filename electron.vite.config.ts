// electron-vite compila las TRES capas por separado (main, preload, renderer).
// Entradas por defecto: src/main/index.ts, src/preload/index.ts, src/renderer/index.html
//
// electron-vite 6 + Vite 8 empaquetan con ROLLDOWN: las opciones van en `rolldownOptions`.
// OJO: si se usa `rollupOptions`, electron-vite lo PISA en silencio con rolldownOptions.
// Las dependencias (koffi, etc.) se externalizan por defecto: no hace falta externalizeDepsPlugin.

import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {
    build: {
      rolldownOptions: {
        // Un preload con sandbox TIENE que ser CommonJS. Como el package es "type": "module", usamos .cjs.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rolldownOptions: {
        // DOS páginas: la app (la cortina) y el "oyente": una ventana invisible que escucha el botón
        // PS/Guide aunque la cortina esté recogida. Es mínima: no carga biblioteca ni sonidos.
        input: {
          index: resolve('src/renderer/index.html'),
          listener: resolve('src/renderer/listener.html'),
        },
      },
    },
  },
})
