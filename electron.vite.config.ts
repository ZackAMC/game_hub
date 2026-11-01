// electron-vite compila las TRES capas por separado (main, preload, renderer).
// Entradas por defecto: src/main/index.ts, src/preload/index.ts, src/renderer/index.html

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Un preload con sandbox TIENE que ser CommonJS. Como el package es "type": "module", usamos .cjs.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
})
