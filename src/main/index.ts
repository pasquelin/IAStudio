import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { WINDOW_CHROME_COLOR } from '@shared/constants'
import { resolveLanguage } from '@shared/i18n'
import { buildMenu } from '@main/menu'
import { registerWindowControls, trackWindowState } from '@main/window/controls'
import { lockNavigation } from '@main/window/navigation'

const isDevelopment = !app.isPackaged

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: WINDOW_CHROME_COLOR,
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

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDevelopment && devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  return window
}

void app.whenReady().then(() => {
  lockNavigation()
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
