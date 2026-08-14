import { mdiClose, mdiCloseBoxMultipleOutline, mdiTrashCanOutline } from '@mdi/js'
import { showContextMenu } from '@/helpers/context-menu'
import { reportFailure } from '@/services/diagnostics'
import { closeTab } from './close-tab'
import { closeDocument, deleteDocument } from './document-io'
import { openPanelIds } from './dockview-api'

export type DocumentTabMenuProps = {
  documentId: string
  /** Already translated, as the system's menu takes them. */
  labels: { close: string; closeOthers: string; delete: string }
  /** What each row does, for the tooltip macOS shows on hover. */
  hints: { close: string; closeOthers: string; delete: string }
}

/**
 * What can be done to a tab, right-clicked.
 *
 * Delete is the only way to remove a document from the project: closing a tab has never taken
 * a file with it, and until this menu existed a document written once could not be removed
 * from inside the studio at all.
 *
 * The menu is gone by the time any of these fails, so the journal is where a failure lands.
 */
export function openDocumentTabMenu({ documentId, labels, hints }: DocumentTabMenuProps): void {
  void showContextMenu([
    {
      label: labels.close,
      icon: mdiClose,
      tooltip: hints.close,
      onSelect: () => closeTab(documentId),
    },
    {
      label: labels.closeOthers,
      icon: mdiCloseBoxMultipleOutline,
      tooltip: hints.closeOthers,
      disabled: openPanelIds().length < 2,
      onSelect: () =>
        void closeOthers(documentId).catch(error =>
          reportFailure('document.close', documentId, error),
        ),
    },
    {
      label: labels.delete,
      icon: mdiTrashCanOutline,
      tooltip: hints.delete,
      onSelect: () =>
        void deleteDocument(documentId).catch(error =>
          reportFailure('document.delete', documentId, error),
        ),
    },
  ])
}

/**
 * The other tabs, one after another rather than all at once: each may ask about unsaved work,
 * and three dialogs stacked on top of each other is not a question anyone can answer. A cancel
 * stops the run — the user said no to closing, not to this one tab.
 */
async function closeOthers(keptId: string): Promise<void> {
  for (const id of openPanelIds()) {
    if (id === keptId) continue
    if (!(await closeDocument(id))) return
  }
}
