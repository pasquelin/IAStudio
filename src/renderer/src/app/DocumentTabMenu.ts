import { mdiClose, mdiCloseBoxMultipleOutline, mdiTrashCanOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import { showContextMenu } from '@/helpers/context-menu'
import { reportFailure } from '@/services/diagnostics'
import { closeTab } from './close-tab'
import { closeDocument, deleteDocument } from './document-io'
import { openPanelIds } from './dockview-api'

export type DocumentTabMenuProps = {
  documentId: string
  /** The window's translator, as every menu of this studio takes it — see `openAssetMenu`. */
  t: TFunction
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
export function openDocumentTabMenu({ documentId, t }: DocumentTabMenuProps): void {
  void showContextMenu([
    {
      label: t('documents.close'),
      icon: mdiClose,
      tooltip: t('documents.closeHint'),
      onSelect: () => closeTab(documentId),
    },
    {
      label: t('documents.closeOthers'),
      icon: mdiCloseBoxMultipleOutline,
      tooltip: t('documents.closeOthersHint'),
      disabled: openPanelIds().length < 2,
      onSelect: () =>
        void closeOthers(documentId).catch(error =>
          reportFailure('document.close', documentId, error),
        ),
    },
    {
      label: t('documents.delete'),
      icon: mdiTrashCanOutline,
      tooltip: t('documents.deleteHint'),
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
