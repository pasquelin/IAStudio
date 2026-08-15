import type { CloseChoice } from '@shared/domain/document'
import { fillHoles, TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from '@main/window/language'

/**
 * The two questions a document asks before it goes away, phrased here rather than in the
 * window.
 *
 * Native, like the one the settings window already asks: this is the convention every desktop
 * application answers with, and a drawn dialog would be the one surface of the studio the OS
 * does not put in front. The renderer asks the question; it never phrases it — the wording and
 * the button order are the main process's, beside the menu's.
 *
 * `AskUser` is injected for the same reason `reveal` is: `dialog` needs a live app, and a test
 * has none.
 */
export type AskUser = (options: {
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
}) => Promise<number>

/**
 * What to do with a document that has unsaved work.
 *
 * Cancel is the cancel button AND what a dismissed dialog gives back: closing a tab is the one
 * gesture here that throws work away, so an Escape must never be read as consent.
 */
export async function askCloseChoice(ask: AskUser, title: string): Promise<CloseChoice> {
  const t = TRANSLATIONS[windowLanguage()].documents

  const chosen = await ask({
    message: fillHoles(t.saveTitle, { title }),
    detail: t.saveBody,
    // Save first: it is the platform order on macOS and the answer that loses nothing.
    buttons: [t.save, t.dontSave, t.cancel],
    defaultId: 0,
    cancelId: 2,
  })

  if (chosen === 0) return 'save'
  return chosen === 1 ? 'discard' : 'cancel'
}

/** Whether the file really goes. Irreversible, so Cancel is both the default and the dismissal. */
export async function askDeleteDocument(ask: AskUser, title: string): Promise<boolean> {
  const t = TRANSLATIONS[windowLanguage()].documents

  const chosen = await ask({
    message: fillHoles(t.deleteTitle, { title }),
    detail: t.deleteBody,
    buttons: [t.cancel, t.deleteConfirm],
    defaultId: 0,
    cancelId: 0,
  })

  return chosen === 1
}
