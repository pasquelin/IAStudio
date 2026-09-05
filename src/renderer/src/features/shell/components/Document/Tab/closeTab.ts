import { closeDocument } from '../../../documentIo'
import { closeFileView, panelIsFileView } from '../../dockviewApi'
import { reportFailure } from '@/services/diagnostics'

/**
 * Closes a document from a gesture that has no surface of its own to fail on — the tab's cross,
 * a row of its menu. Both offer the same thing under the same label, so both fail the same way:
 * into the journal, which is where a ⌘S that will not write already reports.
 *
 * Nothing is awaited. The dialog is the answer the user gets; a caller waiting on the promise
 * would only be waiting to do nothing with it.
 */
export function closeTab(tabId: string): void {
  // A file view is not a document: `closeDocument` finds no io for it, so it asks nothing and
  // drops the edits. Every closing gesture comes here so none of them can forget the branch.
  if (panelIsFileView(tabId)) {
    closeFileView(tabId)
    return
  }
  void closeDocument(tabId).catch(error => reportFailure('document.close', tabId, error))
}
