import { closeDocument } from '../../../documentIo'
import { reportFailure } from '@/services/diagnostics'

/**
 * Closes a document from a gesture that has no surface of its own to fail on — the tab's cross,
 * a row of its menu. Both offer the same thing under the same label, so both fail the same way:
 * into the journal, which is where a ⌘S that will not write already reports.
 *
 * Nothing is awaited. The dialog is the answer the user gets; a caller waiting on the promise
 * would only be waiting to do nothing with it.
 */
export function closeTab(documentId: string): void {
  void closeDocument(documentId).catch(error => reportFailure('document.close', documentId, error))
}
