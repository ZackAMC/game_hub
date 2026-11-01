// PRELOAD: el puente. Expone una API CHICA y explícita; nunca ipcRenderer entero.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type GameHubApi, type SessionDTO } from '../shared/contract.js'

const api: GameHubApi = {
  list: () => ipcRenderer.invoke(IPC.list),
  launch: (gameId) => ipcRenderer.invoke(IPC.launch, gameId),
  addLocal: () => ipcRenderer.invoke(IPC.addLocal),
  removeLocal: (gameId) => ipcRenderer.invoke(IPC.removeLocal, gameId),
  toggleFullscreen: () => ipcRenderer.invoke(IPC.toggleFullscreen),
  isFullscreen: () => ipcRenderer.invoke(IPC.isFullscreen),
  onFullscreenChange: (listener) => {
    const handler = (_event: IpcRendererEvent, fullscreen: boolean): void => listener(fullscreen)
    ipcRenderer.on(IPC.fullscreenChanged, handler)
    return () => ipcRenderer.removeListener(IPC.fullscreenChanged, handler)
  },
  achievements: (gameId) => ipcRenderer.invoke(IPC.achievements, gameId),
  steamKeyStatus: () => ipcRenderer.invoke(IPC.steamKeyStatus),
  setSteamKey: (key) => ipcRenderer.invoke(IPC.setSteamKey, key),
  clearSteamKey: () => ipcRenderer.invoke(IPC.clearSteamKey),
  openSteamKeyPage: () => ipcRenderer.invoke(IPC.openSteamKeyPage),
  artworkSearch: (term) => ipcRenderer.invoke(IPC.artworkSearch, term),
  artworkApply: (gameId, candidateId) => ipcRenderer.invoke(IPC.artworkApply, gameId, candidateId),
  artworkPickFile: (gameId, kind) => ipcRenderer.invoke(IPC.artworkPickFile, gameId, kind),
  artworkClear: (gameId) => ipcRenderer.invoke(IPC.artworkClear, gameId),
  onSessionChange: (listener) => {
    const handler = (_event: IpcRendererEvent, session: SessionDTO): void => listener(session)
    ipcRenderer.on(IPC.sessionChanged, handler)
    return () => ipcRenderer.removeListener(IPC.sessionChanged, handler)
  },
  setManualPlaytime: (gameId, hours) => ipcRenderer.invoke(IPC.setManualPlaytime, gameId, hours),
  openFolder: (gameId) => ipcRenderer.invoke(IPC.openFolder, gameId),
  uninstallPreview: (gameId) => ipcRenderer.invoke(IPC.uninstallPreview, gameId),
  uninstall: (gameId) => ipcRenderer.invoke(IPC.uninstall, gameId),
  sgdbKeyStatus: () => ipcRenderer.invoke(IPC.sgdbKeyStatus),
  setSgdbKey: (key) => ipcRenderer.invoke(IPC.setSgdbKey, key),
  openSgdbKeyPage: () => ipcRenderer.invoke(IPC.openSgdbKeyPage),
}

contextBridge.exposeInMainWorld('hub', api)
