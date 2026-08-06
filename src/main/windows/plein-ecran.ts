import { BrowserWindow } from 'electron'

/**
 * Bascule le plein écran natif. `simpleFullScreen` a été écarté : il ne fait qu'agrandir la
 * fenêtre à la taille de l'écran en passant Dock et barre de menu en masquage automatique —
 * ce n'est pas un plein écran, et ça se voit.
 *
 * En plein écran natif, macOS retire la barre de titre de la fenêtre ; les feux de
 * circulation sont redemandés par `setWindowButtonVisibility` à l'entrée (cf. `main/index`).
 */
export function basculerPleinEcran(fenetre: BrowserWindow | null): void {
  const cible = fenetre ?? BrowserWindow.getFocusedWindow()
  if (!cible) return
  cible.setFullScreen(!cible.isFullScreen())
}

export function estPleinEcran(fenetre: BrowserWindow | null): boolean {
  return fenetre?.isFullScreen() ?? false
}
