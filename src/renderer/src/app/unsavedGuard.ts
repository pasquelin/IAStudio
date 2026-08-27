import { reportFailure } from '@/services/diagnostics'
import { settleUnsavedScripts, unsavedScripts } from '@/stores/code'
import { settleUnsavedWork, unsavedDocumentIds } from './documentIo'

/** The scripts first, which no dialog interrupts, then the documents, which ask. */
async function settleEverything(): Promise<boolean> {
  await settleUnsavedScripts()
  return await settleUnsavedWork()
}

/**
 * Keeps the window from going while a document still holds unsaved work, and says so instead of
 * letting it go silently.
 *
 * `beforeunload` is the one moment Chromium asks the document whether it may leave, and it asks
 * **synchronously** — no dialog can be awaited from here. So the gesture is refused first and
 * the question asked after: once every document has been answered for, nothing is dirty and the
 * next attempt goes straight through.
 *
 * It covers the ways the work goes with the window rather than with a tab — quitting, and the
 * developer reload. It does not cover `refreshDocuments`, which drops documents on a project
 * change without unloading anything, and which no `beforeunload` can see.
 *
 * The SCRIPTS go with it, and they are written rather than asked about — see
 * `settleUnsavedScripts` for why a `.ts` is not a document.
 */
export function guardUnsavedWork(target: Window): () => void {
  // A second ⌘Q while the first question is still on screen would stack a dialog per press.
  let asking = false

  const refuse = (event: BeforeUnloadEvent): void => {
    if (unsavedDocumentIds().length === 0 && unsavedScripts().length === 0) return
    event.preventDefault()
    if (asking) return

    asking = true
    void settleEverything()
      // A write that throws — a project on a volume that went away — would otherwise close the
      // dialog and say nothing, leaving every attempt to leave to replay the same silent scene.
      .catch(error => reportFailure('document.close', '', error))
      .finally(() => {
        asking = false
      })
  }

  target.addEventListener('beforeunload', refuse)
  return () => target.removeEventListener('beforeunload', refuse)
}
