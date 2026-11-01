# Game Hub

Un launcher para Windows **con alma de consola**: tus juegos de Steam y tus `.exe` sueltos en un solo lugar, con una interfaz limpia, sonidos propios y control total desde un mando de PlayStation o Xbox. Vive escondido arriba de tu monitor y **baja como una cortina** cuando apretás el botón **PS**.

## Descargar

1. Bajá `Game Hub Setup 1.0.0.exe` desde [**Releases**](https://github.com/ZackAMC/game_hub/releases/latest).
2. Ejecutalo. Windows va a mostrar *"Windows protegió su PC"* porque el instalador no está firmado: **Más información → Ejecutar de todas formas**.
3. Abrí Game Hub. Desde ahí arranca solo con Windows, escondido y listo para el botón PS.

> **Requisitos:** Windows 10/11 de 64 bits. Steam es opcional: sin Steam, el hub funciona solo con juegos locales.

## Qué hace

| | |
|---|---|
| 🎮 **Biblioteca unificada** | Detecta tus juegos de Steam (todas las bibliotecas) y suma cualquier `.exe` a mano. |
| 🪟 **Modo cortina** | La app cubre el monitor principal y se recoge sola cuando arranca un juego. Al cerrarlo, vuelve. |
| 🕹️ **Mandos** | DualSense / DualShock y Xbox, con los íconos del mando que estás usando. |
| ⏱️ **Tiempo de juego** | Horas por sesión, semana y mes para juegos locales (y horas previas cargadas a mano). Para Steam, el total que informa Steam. |
| 🏆 **Logros de Steam** | Desbloqueados, fecha y rareza global. |
| 🖼️ **Portadas** | Las de Steam automáticamente; para juegos locales, desde la tienda de Steam, SteamGridDB o un archivo tuyo. |
| 🗑️ **Desinstalar** | Steam lo hace con su propio asistente. Los locales van a la **Papelera**, con una regla que bloquea carpetas peligrosas (Descargas, Documentos, la raíz de un disco…). |
| 🔊 **Sonido e intro** | Todo sintetizado en tiempo real: cero archivos de audio. |

## Controles

| Acción | Mando PlayStation | Mando Xbox | Teclado |
|---|---|---|---|
| Abrir / recoger la cortina | **PS** | **Guide** \* | **Ctrl + Alt + G** |
| Moverse | Cruceta / stick | Cruceta / stick | Flechas |
| Elegir / jugar | ✕ | A | Enter |
| Volver / cerrar | ○ | B | Esc |
| Opciones del juego | △ | Y | Clic en **⋯** |
| Cambiar filtro | L1 / R1 | LB / RB | RePág / AvPág |
| Diagnóstico de mandos | — | — | F9 |

\* Probado con DualSense. En Xbox **no está probado**: la **Game Bar** de Windows suele quedarse con el botón Guide. Si no responde, usá Ctrl+Alt+G.

**Salir de la app:** clic derecho en el ícono de la bandeja → **Salir**. Alt+F4 solo recoge la cortina. En ese mismo menú se activa o desactiva **Iniciar con Windows**.

## Logros y portadas (opcional)

Las dos funciones necesitan **tu propia** API key. Se cargan desde la app y nunca salen de tu PC.

| Para… | Key | Dónde se consigue |
|---|---|---|
| Logros y horas de Steam | Steam Web API key | [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) |
| Portadas de juegos locales | SteamGridDB API key | [steamgriddb.com/profile/preferences/api](https://www.steamgriddb.com/profile/preferences/api) |

Para logros y horas, tu perfil de Steam tiene que tener **Detalles de juego: Público** (Perfil → Editar perfil → Privacidad).

## Privacidad y seguridad

- **Las keys se guardan cifradas** con DPAPI de Windows en `%APPDATA%\game-hub`: solo tu usuario, en tu PC, puede descifrarlas. **No** están en el instalador ni en este repositorio, y la interfaz nunca las recibe de vuelta.
- **La interfaz está aislada:** `contextIsolation`, `sandbox` y una API mínima en el preload. Todo lo que pide la UI se valida en el proceso principal.
- **Desinstalar es reversible:** las carpetas van a la Papelera, y la regla de carpetas peligrosas se vuelve a aplicar en el proceso principal aunque la UI falle.

## Limitaciones conocidas

- El botón PS **no** abre la cortina mientras corre un juego lanzado desde el hub. Una ventana "siempre encima" sobre el juego podría quitarle rendimiento. Usá Ctrl+Alt+G.
- Los juegos no se pueden mostrar *dentro* de la app: Windows no lo permite. El hub se recoge y vuelve.
- Solo Windows.

---

## Desarrollo

```bash
pnpm install      # también descarga el binario de Electron (postinstall)
pnpm dev          # app con recarga en vivo
pnpm test         # tests (node:test + tsx)
pnpm typecheck    # los tres tsconfig: Node, renderer y tests del renderer
pnpm dist         # instalador NSIS en dist/
```

Stack: **Electron 45 · React 18 · TypeScript · electron-vite 6 (Vite 8) · electron-builder**.

### Arquitectura

Hexagonal: el dominio no sabe que existen Electron, Steam ni el disco.

```
src/
├── domain/        Reglas puras: Game, Playtime, UninstallGuard… y los PUERTOS (interfaces)
├── application/   Casos de uso: GameCatalog, AchievementService, StorePlaytimeService…
├── adapters/      Implementaciones: steam/, local/, artwork/, secrets/, system/
├── main/          Composition root: arma todo, IPC, ventanas (la cortina), bandeja
├── preload/       El puente: la API mínima expuesta como window.hub
├── shared/        El contrato IPC (solo datos planos)
└── renderer/      La UI (React) y el "oyente" del botón PS
```

**Sumar una tienda nueva** (Epic, GOG…) es escribir un adaptador de `GameSource` y agregarlo a la lista en `src/main/index.ts`. El resto de la app no cambia.

### Decisiones que no son obvias

| Tema | Decisión |
|---|---|
| Animación de la cortina | La ventana queda quieta y transparente; se desliza la UI con CSS. `setBounds` animado en Windows va a los saltos. |
| Botón PS con la app oculta | Chromium solo le da el mando a páginas **visibles**: una ventana invisible de 1 px escucha el botón. |
| Foco al abrir con el mando | Windows bloquea el robo de foco (el mando no cuenta como "entrada"); se usa `AttachThreadInput` vía koffi. |
| Horas de Steam | Un solo pedido para toda la biblioteca, con caché de 5 min y espera acotada: la red nunca traba la UI. |
| Config de Vite | Con electron-vite 6 las opciones van en `rolldownOptions`: `rollupOptions` se pisa en silencio. |
