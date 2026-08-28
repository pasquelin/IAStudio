import { mdiViewDashboardOutline } from '@mdi/js'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { CommandId } from '@shared/domain/command'
import { EmptyState } from '@/design/EmptyState'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocumentIsInFront } from '@/stores/documents'
import { isGuiDirty, useGuis } from '@/stores/gui'

/**
 * A game interface, open. It holds its history and its title from this lot; what DRAWS it — the
 * stage, the handles, the hierarchy — arrives with the editor.
 *
 * The scope is `gui` and not the space's: the 3D space opens two kinds now, so ⌘Z here must not
 * reach the scene's history — `scopeOfDocument` says which, and this is the other half of it.
 */
export function GuiDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const active = useDocumentIsInFront(documentId)

  useDocumentTitle(
    documentId,
    useGuis(state => isGuiDirty(state, documentId)),
  )

  useRestoredDocument(documentId)

  const onCommand = useCallback(
    (command: CommandId) => {
      const store = useGuis.getState()
      if (command === 'gui.undo') return store.undo(documentId)
      if (command === 'gui.redo') return store.redo(documentId)
    },
    [documentId],
  )

  useShortcuts({ scope: 'gui', enabled: active, documentId, onCommand })

  return <EmptyState icon={mdiViewDashboardOutline} message={t('documents.guiEmpty')} />
}
