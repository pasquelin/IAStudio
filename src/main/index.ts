import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { BACKGROUND_COLOR } from '@shared/constants'
import { resolveLanguage } from '@shared/i18n'
import { buildMenu } from '@main/menu'
import { registerWindowControls, trackWindowState } from '@main/window/controls'

const isDevelopment = !app.isPackaged

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  trackWindowState(window)
  window.once('ready-to-show', () => window.show())

  // Outgoing navigation goes to the system browser: a studio window must never turn into
  // a web browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDevelopment && devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  return window
}

void app.whenReady().then(() => {
  registerWindowControls()
  buildMenu(resolveLanguage(app.getLocale()))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
