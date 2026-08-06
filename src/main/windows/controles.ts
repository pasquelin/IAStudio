import { BrowserWindow, ipcMain } from 'electron'
import type { EtatFenetre } from '@shared/domain/fenetre'
import { CANAUX, EVENEMENTS } from '@shared/ipc'

function etatDe(fenetre: BrowserWindow): EtatFenetre {
  return {
    active: fenetre.isFocused(),
    pleinEcran: fenetre.isKiosk(),
    maximisee: fenetre.isMaximized(),
  }
}

/**
 * Plein écran en **mode kiosque** plutôt qu'en plein écran natif. La différence est la
 * barre de menu : le plein écran natif la met en masquage automatique — elle redescend dès
 * que le curseur approche du haut, par-dessus notre barre — alors que le kiosque la masque
 * pour de bon. Le Dock suit la même règle.
 *
 * Sortie possible par ⌃⌘F, par le menu, et par la pastille verte.
 */
export function basculerPleinEcran(fenetre: BrowserWindow | null): void {
  const cible = fenetre ?? BrowserWindow.getFocusedWindow()
  if (!cible) return
  cible.setKiosk(!cible.isKiosk())
}

/** Pousse l'état au renderer : les pastilles dessinées s'y accordent (couleur, désactivation). */
export function suivreEtat(fenetre: BrowserWindow): void {
  const pousser = (): void => {
    if (fenetre.isDestroyed()) return
    fenetre.webContents.send(EVENEMENTS.fenetreEtat, etatDe(fenetre))
  }

  fenetre.on('focus', pousser)
  fenetre.on('blur', pousser)
  fenetre.on('maximize', pousser)
  fenetre.on('unmaximize', pousser)
  fenetre.on('resize', pousser)
  fenetre.webContents.on('did-finish-load', pousser)
}

export function enregistrerControlesFenetre(): void {
  const fenetreDe = (evenement: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(evenement.sender)

  ipcMain.handle(CANAUX.fenetreFermer, evenement => fenetreDe(evenement)?.close())

  ipcMain.handle(CANAUX.fenetreReduire, evenement => {
    const fenetre = fenetreDe(evenement)
    // Réduire depuis le plein écran laisserait une fenêtre kiosque dans le Dock, sans
    // barre de menu pour la rappeler. macOS désactive d'ailleurs le bouton dans ce cas.
    if (fenetre && !fenetre.isKiosk()) fenetre.minimize()
  })

  ipcMain.handle(CANAUX.fenetreZoomer, evenement => {
    const fenetre = fenetreDe(evenement)
    if (!fenetre) return
    if (fenetre.isMaximized()) fenetre.unmaximize()
    else fenetre.maximize()
  })

  ipcMain.handle(CANAUX.fenetrePleinEcran, evenement => basculerPleinEcran(fenetreDe(evenement)))

  ipcMain.handle(CANAUX.fenetreEtat, evenement => {
    const fenetre = fenetreDe(evenement)
    return fenetre ? etatDe(fenetre) : null
  })
}
