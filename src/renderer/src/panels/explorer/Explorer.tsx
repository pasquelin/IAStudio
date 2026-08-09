import { mdiFolderOpenOutline } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { openDocument } from '@/app/dockview-api'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { DocumentRow } from './DocumentRow'

/**
 * The documents of the project, open or not.
 *
 * This is what makes a closed document reachable again. The layout says which documents are on
 * screen and the folder says which exist, and until this panel listed the second the difference
 * between the two was unreachable from inside the studio — a document closed while no layout
 * held it could only be found on disk.
 *
 * The same list in all six workspaces, and a row opens wherever it belongs: a sequence opened
 * from the Image workspace switches to Video, which is what double-clicking an asset already
 * does. Filing them per workspace would hide from the user the one document they are hunting.
 */
export function Explorer() {
  const { t } = useTranslation()
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)
  const projectPath = useProject(state => state.project?.path ?? null)

  // Opening a project already lists it; this is for what has been written since. `relist` and
  // not `refresh`: settling which tabs are open is the project's business, not this panel's.
  useEffect(() => {
    void useDocuments.getState().relist()
  }, [projectPath])

  if (!projectPath)
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.noProject')} />

  return (
    <Collection
      label={t('panels.explorer')}
      items={stored}
      // Not a selection one makes — it is what "open" looks like in this list.
      selectedIds={Object.keys(open)}
      onActivate={openDocument}
      renderRow={(document: DocumentDescriptor) => (
        <DocumentRow document={document} open={open[document.id] !== undefined} />
      )}
      empty={<EmptyState icon={mdiFolderOpenOutline} message={t('explorer.noDocuments')} />}
    />
  )
}
