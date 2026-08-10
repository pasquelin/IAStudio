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
 * The documents of the project, flat, open or not.
 *
 * This is what makes a closed document reachable again: the layout says which documents are on
 * screen and the folder says which exist, and a document closed while no layout held it can only
 * be found here.
 *
 * It is NOT the Explorer, and the difference is the point. The Explorer walks the project folder
 * as a tree — `assets/`, `documents/`, and whatever was dropped in there — where a document is
 * one file among many, one fold down. This lists the documents themselves, which is the question
 * the home asks: what is there to open. The two were the same panel until the Explorer became a
 * file browser, and the home kept the list it had always shown.
 */
export function Documents() {
  const { t } = useTranslation()
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)
  const projectPath = useProject(state => state.project?.path ?? null)

  // Opening a project already lists it; this is for what has been written since. `relist` and
  // not `refresh`: settling which tabs are open is the project's business, not this panel's.
  useEffect(() => {
    void useDocuments.getState().relist()
  }, [projectPath])

  // Its own way out rather than a trip elsewhere: with no folder open there is nothing to list,
  // and the two gestures that fix it are the ones the whole home is built around.
  if (!projectPath)
    return (
      <EmptyState
        icon={mdiFolderOpenOutline}
        message={t('explorer.noProject')}
        action={{
          label: t('project.open'),
          hint: t('project.openHint'),
          onClick: () => void useProject.getState().openPicked(),
        }}
        secondary={{
          label: t('project.create'),
          hint: t('project.createHint'),
          onClick: () => void useProject.getState().createPicked(),
        }}
      />
    )

  return (
    <Collection
      label={t('panels.documents')}
      items={stored}
      // No `selectedIds`: nothing is picked here. "Open" used to borrow the prop, which painted
      // the selection tint on rows the user had never chosen. `DocumentRow` carries its own mark.
      onActivate={openDocument}
      renderRow={(document: DocumentDescriptor) => (
        <DocumentRow document={document} open={open[document.id] !== undefined} />
      )}
      empty={<EmptyState icon={mdiFolderOpenOutline} message={t('home.documents.none')} />}
    />
  )
}
