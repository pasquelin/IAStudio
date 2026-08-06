import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { COULEUR_FOND } from '@shared/constantes'
import { resoudreLangue } from '@shared/i18n'
import { poserMenu } from '@main/menu'
import { enregistrerControlesFenetre, suivreEtat } from '@main/windows/controles'

const enDeveloppement = !app.isPackaged

function creerFenetre(): BrowserWindow {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: COULEUR_FOND,
    // Les feux natifs sont remplacés par des pastilles dessinées : macOS les retire en
    // plein écran, et rien dans Electron ne permet de les y garder — cf. `BoutonsFenetre`.
    titleBarStyle: 'hidden',
    fullscreenable: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  fenetre.setWindowButtonVisibility(false)
  suivreEtat(fenetre)

  fenetre.once('ready-to-show', () => fenetre.show())

  // Toute navigation sortante part dans le navigateur : une fenêtre du studio ne doit
  // jamais devenir un navigateur web.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const urlDev = process.env['ELECTRON_RENDERER_URL']
  if (enDeveloppement && urlDev) void fenetre.loadURL(urlDev)
  else void fenetre.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  return fenetre
}

void app.whenReady().then(() => {
  enregistrerControlesFenetre()
  poserMenu(resoudreLangue(app.getLocale()))
  creerFenetre()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
