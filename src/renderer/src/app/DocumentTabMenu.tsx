import { mdiClose, mdiCloseBoxMultipleOutline, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import type { LogScope } from '@shared/ipc'
import { reportFailure } from '@/services/diagnostics'
import { closeDocument, deleteDocument } from './document-io'
import { openPanelIds } from './dockview-api'

export type DocumentTabMenuProps = {
  documentId: string
  at: { x: number; y: number }
  onClose: () => void
}

/**
 * What can be done to a tab, right-clicked.
 *
 * Delete is the only way to remove a document from the project: closing a tab has never taken
 * a file with it, and until this menu existed a document written once could not be removed
 * from inside the studio at all.
 */
export function DocumentTabMenu({ documentId, at, onClose }: DocumentTabMenuProps) {
  const { t } = useTranslation()

  const run = (work: Promise<unknown>, scope: LogScope): void => {
    onClose()
    // Every one of these can fail on the disk, and none of them has a surface of its own by the
    // time it does — the menu is gone. The journal is where it lands.
    void work.catch(error => reportFailure(scope, documentId, error))
  }

  return (
    <ContextMenu at={at} onClose={onClose}>
      <MenuRow
        label={t('documents.close')}
        icon={mdiClose}
        onSelect={() => run(closeDocument(documentId), 'document.close')}
      />
      <MenuRow
        label={t('documents.closeOthers')}
        icon={mdiCloseBoxMultipleOutline}
        disabled={openPanelIds().length < 2}
        onSelect={() => run(closeOthers(documentId), 'document.close')}
      />
      <MenuRow
        label={t('documents.delete')}
        icon={mdiTrashCanOutline}
        onSelect={() => run(deleteDocument(documentId), 'document.delete')}
      />
    </ContextMenu>
  )
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
