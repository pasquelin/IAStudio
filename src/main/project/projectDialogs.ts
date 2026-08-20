import { fillHoles, TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from '@main/window/language'
import { askConfirm, type AskUser } from './documentDialogs'

/**
 * Whether the studio may lay a project into a folder that already holds files of its own.
 *
 * Asked rather than refused: dropping a project beside an existing set of rushes is a legitimate
 * gesture, and the studio only ADDS folders — nothing of theirs is touched. What it must not do
 * is do it silently, since `assets` and `documents` appearing in someone's folder unannounced
 * reads as the application having made a mess.
 */
export async function askUseOccupiedFolder(ask: AskUser, folder: string): Promise<boolean> {
  const language = windowLanguage()
  const t = TRANSLATIONS[language].project

  return await askConfirm(ask, {
    message: fillHoles(t.occupiedTitle, { folder }, language),
    detail: t.occupiedBody,
    confirm: t.occupiedConfirm,
    cancel: t.occupiedCancel,
  })
}

/**
 * Whether a BATCH really goes to the trash. Asked from two files up, never from a window.
 *
 * Asked at all because this is the one gesture the explorer offers that `⌘Z` cannot take back:
 * `shell.trashItem` has no portable way back, so the studio's undo stack deliberately stops
 * here. Everything else — moving, duplicating, creating, renaming — is one keystroke away from
 * being undone and asks nothing.
 *
 * **One file still goes without a question**, which is the shape of the risk rather than a
 * softening: it is named on the row that was clicked, its own name is in the menu, and it lands
 * somewhere the system offers to put back. A selection of thirty is a number nobody re-reads.
 */
export async function askTrashFiles(ask: AskUser, count: number): Promise<boolean> {
  const language = windowLanguage()
  const t = TRANSLATIONS[language].explorer

  return await askConfirm(ask, {
    message: fillHoles(t.trashTitle, { count }, language),
    detail: t.trashBody,
    confirm: t.trashConfirm,
    cancel: t.trashCancel,
  })
}
