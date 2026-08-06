import { BrowserWindow, ipcMain } from 'electron'
import type { EtatFenetre } from '@shared/domain/fenetre'
import { CANAUX, EVENEMENTS } from '@shared/ipc'

function etatDe(fenetre: BrowserWindow): EtatFenetre {
  return {
    active: fenetre.isFocused(),
    pleinEcran: fenetre.isFullScreen(),
    maximisee: fenetre.isMaximized(),
  }
}

export function basculerPleinEcran(fenetre: BrowserWindow | null): void {
  const cible = fenetre ?? BrowserWindow.getFocusedWindow()
  if (!cible) return
  cible.setFullScreen(!cible.isFullScreen())
}

/**
 * Pousse l'état de la fenêtre au renderer. La barre de titre en a besoin : en plein écran,
 * macOS retire les feux de circulation, et le retrait laisserait sinon un creux de 80 px à
 * gauche des onglets d'espaces.
 */
export function suivreEtat(fenetre: BrowserWindow): void {
  const pousser = (): void => {
    if (fenetre.isDestroyed()) return
    fenetre.webContents.send(EVENEMENTS.fenetreEtat, etatDe(fenetre))
  }

  fenetre.on('focus', pousser)
  fenetre.on('blur', pousser)
  fenetre.on('maximize', pousser)
  fenetre.on('unmaximize', pousser)
  fenetre.on('enter-full-screen', pousser)
  fenetre.on('leave-full-screen', pousser)
  fenetre.webContents.on('did-finish-load', pousser)
}

export function enregistrerControlesFenetre(): void {
  ipcMain.handle(CANAUX.fenetrePleinEcran, evenement =>
    basculerPleinEcran(BrowserWindow.fromWebContents(evenement.sender)),
  )

  ipcMain.handle(CANAUX.fenetreEtat, evenement => {
    const fenetre = BrowserWindow.fromWebContents(evenement.sender)
    return fenetre ? etatDe(fenetre) : null
  })
}
