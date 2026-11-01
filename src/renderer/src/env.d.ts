// `window.hub` existe y tiene la forma del contrato que implementa el preload.

import type { GameHubApi } from '../../shared/contract'

declare global {
  interface Window {
    hub: GameHubApi
  }
}

export {}
