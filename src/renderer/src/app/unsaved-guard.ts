import { settleUnsavedWork, unsavedDocumentIds } from './document-io'

/**
 * Keeps the window from going while a document still holds unsaved work, and says so instead of
 * letting it go silently.
 *
 * `beforeunload` is the one moment Chromium asks the document whether it may leave, and it asks
 * **synchronously** — no dialog can be awaited from here. So the gesture is refused first and
 * the question asked after: once every document has been answered for, nothing is dirty and the
 * next attempt goes straight through.
 *
 * The guard covers the two ways the work goes without a tab being closed — quitting, and the
 * developer reload — because neither passes through `closeDocument`.
 */
export function guardUnsavedWork(target: Window): () => void {
  // A second ⌘Q while the first question is still on screen would stack a dialog per press.
  let asking = false

  const refuse = (event: BeforeUnloadEvent): void => {
    if (unsavedDocumentIds().length === 0) return
    event.preventDefault()
    if (asking) return

    asking = true
    void settleUnsavedWork().finally(() => {
      asking = false
    })
  }

  target.addEventListener('beforeunload', refuse)
  return () => target.removeEventListener('beforeunload', refuse)
}
