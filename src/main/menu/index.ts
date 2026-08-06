import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { EVENEMENTS } from '@shared/ipc'
import { TRADUCTIONS, type Langue } from '@shared/i18n'

/** Outils restaurables depuis le menu. Miroir du registre du renderer, volontairement figé
 *  ici : le main ne charge pas le code du renderer, et cette liste bouge rarement. */
const OUTILS_RESTAURABLES: readonly { id: string; zone: string; cle: string }[] = [
  { id: 'explorateur', zone: 'gauche', cle: 'explorateur' },
  { id: 'generateur', zone: 'droite', cle: 'generateur' },
  { id: 'assets', zone: 'bas', cle: 'assets' },
  { id: 'taches', zone: 'bas', cle: 'taches' },
]

function diffuser(canal: string, charge: unknown): void {
  for (const fenetre of BrowserWindow.getAllWindows()) fenetre.webContents.send(canal, charge)
}

/**
 * Menu applicatif natif. Il est la seule voie de retour d'un module retiré par sa croix :
 * un panneau fermé sans moyen de le rouvrir serait un panneau perdu.
 */
export function poserMenu(langue: Langue): void {
  const t = TRADUCTIONS[langue]

  const menuApplication: MenuItemConstructorOptions = { role: 'appMenu', label: app.name }

  const modeles: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [menuApplication] : []),
    {
      label: t.menu.fichier,
      submenu: [
        {
          label: t.menu.nouveauProjet,
          accelerator: 'CmdOrCtrl+N',
          click: () => diffuser(EVENEMENTS.commandeMenu, 'projet:nouveau'),
        },
        {
          label: t.menu.ouvrirProjet,
          accelerator: 'CmdOrCtrl+O',
          click: () => diffuser(EVENEMENTS.commandeMenu, 'projet:ouvrir'),
        },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    { role: 'editMenu', label: t.menu.edition },
    {
      label: t.menu.affichage,
      submenu: [
        {
          label: t.menu.modules,
          submenu: OUTILS_RESTAURABLES.map(outil => ({
            label: t.panneaux[outil.cle as keyof typeof t.panneaux],
            click: () => diffuser(EVENEMENTS.ouvrirOutil, { zone: outil.zone, outil: outil.id }),
          })),
        },
        {
          label: t.menu.reinitialiserDisposition,
          click: () => diffuser(EVENEMENTS.commandeMenu, 'disposition:reinitialiser'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
      ],
    },
    { role: 'windowMenu', label: t.menu.fenetre },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(modeles))
}
