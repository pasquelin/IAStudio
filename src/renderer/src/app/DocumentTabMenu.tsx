import { mdiClose, mdiCloseBoxMultipleOutline, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { reportFailure } from '@/services/diagnostics'
import { closeTab } from './close-tab'
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

  /** The menu is gone by the time any of these fails, so the journal is where it lands. */
  const choose =
    (run: () => void): (() => void) =>
    () => {
      onClose()
      run()
    }

  return (
    <ContextMenu at={at} onClose={onClose}>
      <MenuRow
        label={t('documents.close')}
        icon={mdiClose}
        tip={HINT_RIGHT(t('documents.closeHint'))}
        onSelect={choose(() => closeTab(documentId))}
      />
      <MenuRow
        label={t('documents.closeOthers')}
        icon={mdiCloseBoxMultipleOutline}
        disabled={openPanelIds().length < 2}
        tip={HINT_RIGHT(t('documents.closeOthersHint'))}
        onSelect={choose(() => {
          void closeOthers(documentId).catch(error =>
            reportFailure('document.close', documentId, error),
          )
        })}
      />
      <MenuRow
        label={t('documents.delete')}
        icon={mdiTrashCanOutline}
        tip={HINT_RIGHT(t('documents.deleteHint'))}
        onSelect={choose(() => {
          void deleteDocument(documentId).catch(error =>
            reportFailure('document.delete', documentId, error),
          )
        })}
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
