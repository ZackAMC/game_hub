// electron-vite: `import ruta from './archivo.png?asset'` copia el archivo al build y devuelve su ruta en disco.
declare module '*?asset' {
  const path: string
  export default path
}
