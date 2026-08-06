import { BrowserWindow } from 'electron'

/**
 * Plein écran « simple » : la fenêtre occupe l'écran et masque Dock et barre de menu, mais
 * reste une fenêtre ordinaire. Contrairement au plein écran natif de macOS, elle ne part pas
 * dans un espace dédié — les feux de circulation restent donc visibles, et aucune barre de
 * menu ne vient glisser par-dessus la barre de titre du studio.
 */
export function basculerPleinEcran(fenetre: BrowserWindow | null): void {
  const cible = fenetre ?? BrowserWindow.getFocusedWindow()
  if (!cible) return
  cible.setSimpleFullScreen(!cible.isSimpleFullScreen())
}

export function estPleinEcran(fenetre: BrowserWindow | null): boolean {
  return fenetre?.isSimpleFullScreen() ?? false
}
