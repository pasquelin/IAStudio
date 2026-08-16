import { fillHoles, TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from '@main/window/language'
import type { AskUser } from './document-dialogs'

/**
 * Whether the studio may lay a project into a folder that already holds files of its own.
 *
 * Asked rather than refused: dropping a project beside an existing set of rushes is a legitimate
 * gesture, and the studio only ADDS folders — nothing of theirs is touched. What it must not do
 * is do it silently, since `assets` and `documents` appearing in someone's folder unannounced
 * reads as the application having made a mess.
 *
 * Cancel is the default AND what a dismissed dialog gives back: an Escape is never consent to
 * write in a folder the user may have picked by mistake.
 */
export async function askUseOccupiedFolder(ask: AskUser, folder: string): Promise<boolean> {
  const t = TRANSLATIONS[windowLanguage()].project

  const chosen = await ask({
    message: fillHoles(t.occupiedTitle, { folder }),
    detail: t.occupiedBody,
    buttons: [t.occupiedCancel, t.occupiedConfirm],
    defaultId: 0,
    cancelId: 0,
  })

  return chosen === 1
}
