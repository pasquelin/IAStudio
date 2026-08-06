import { BrowserWindow, ipcMain } from 'electron'
import type { WindowState } from '@shared/domain/window'
import { CHANNELS, EVENTS } from '@shared/ipc'

function stateOf(target: BrowserWindow): WindowState {
  return {
    active: target.isFocused(),
    fullScreen: target.isFullScreen(),
    maximized: target.isMaximized(),
  }
}

export function toggleFullScreen(target: BrowserWindow | null): void {
  const window = target ?? BrowserWindow.getFocusedWindow()
  if (!window) return
  window.setFullScreen(!window.isFullScreen())
}

/**
 * Pousse l'état de la fenêtre au renderer. La barre de titre en a besoin : en plein écran,
 * macOS retire les feux de circulation, et le retrait laisserait sinon un creux de 96 px à
 * gauche des onglets d'espaces.
 */
export function trackWindowState(window: BrowserWindow): void {
  const push = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send(EVENTS.windowState, stateOf(window))
  }

  window.on('focus', push)
  window.on('blur', push)
  window.on('maximize', push)
  window.on('unmaximize', push)
  window.on('enter-full-screen', push)
  window.on('leave-full-screen', push)
  window.webContents.on('did-finish-load', push)
}

export function registerWindowControls(): void {
  ipcMain.handle(CHANNELS.windowToggleFullScreen, event =>
    toggleFullScreen(BrowserWindow.fromWebContents(event.sender)),
  )

  ipcMain.handle(CHANNELS.windowState, event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window ? stateOf(window) : null
  })
}
