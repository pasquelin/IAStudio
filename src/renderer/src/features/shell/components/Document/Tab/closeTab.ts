import { closeDocument } from '../../../documentIo'
import { closeFileViewAsking, panelIsFileView } from '../../dockviewApi'
import { reportFailure } from '@/services/diagnostics'

/**
 * Closes a document from a gesture that has no surface of its own to fail on — the tab's cross,
 * a row of its menu. Both offer the same thing under the same label, so both fail the same way:
 * into the journal, which is where a ⌘S that will not write already reports.
 *
 * Nothing is awaited. The dialog is the answer the user gets; a caller waiting on the promise
 * would only be waiting to do nothing with it.
 */
// A file view is not a document: `closeDocument` finds no io for it, so it asks nothing, drops
// the edits, and answers `true`. The four closing gestures come here so none can forget it.
export async function closeTabAsking(tabId: string): Promise<boolean> {
  return panelIsFileView(tabId) ? await closeFileViewAsking(tabId) : await closeDocument(tabId)
}

/** The same for a gesture with nothing to do with the verdict — a cross, a row of a menu. */
export function closeTab(tabId: string): void {
  void closeTabAsking(tabId).catch(error => reportFailure('document.close', tabId, error))
}
