import { fillHoles, TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from '@main/window/language'
import { askConfirm, type AskUser } from './document-dialogs'

/**
 * Whether the studio may lay a project into a folder that already holds files of its own.
 *
 * Asked rather than refused: dropping a project beside an existing set of rushes is a legitimate
 * gesture, and the studio only ADDS folders — nothing of theirs is touched. What it must not do
 * is do it silently, since `assets` and `documents` appearing in someone's folder unannounced
 * reads as the application having made a mess.
 */
export async function askUseOccupiedFolder(ask: AskUser, folder: string): Promise<boolean> {
  const t = TRANSLATIONS[windowLanguage()].project

  return await askConfirm(ask, {
    message: fillHoles(t.occupiedTitle, { folder }),
    detail: t.occupiedBody,
    confirm: t.occupiedConfirm,
    cancel: t.occupiedCancel,
  })
}
