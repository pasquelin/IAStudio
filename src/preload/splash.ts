import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENTS } from '@shared/ipc'

/**
 * One function, and no way back: the splash sends nothing and asks nothing.
 *
 * The main preload is deliberately not reused — exposing `window.studio`, hence
 * `setCredentials`, to a window that only draws a progress bar would widen the attack surface
 * for nothing (CLAUDE.md, invariant 1).
 */
contextBridge.exposeInMainWorld('splash', {
  onStep: (callback: (label: string, index: number, total: number) => void) => {
    ipcRenderer.on(
      EVENTS.splashStep,
      (_event: IpcRendererEvent, label: string, index: number, total: number) =>
        callback(label, index, total),
    )
  },
})
