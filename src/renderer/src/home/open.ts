import type { WorkspaceId } from '@shared/domain/workspace'
import type { DocumentDescriptor } from '@shared/domain/document'
import { openDocument } from '@/app/dockview-api'
import { createDocumentIn } from '@/app/new-document'
import { useLayouts } from '@/stores/layouts'

/** Leaves the home for a workspace, on a blank document when there is a project to write one in. */
export function enterWorkspace(workspace: WorkspaceId): void {
  useLayouts.getState().setActiveWorkspace(workspace)
  createDocumentIn(workspace)
}

/**
 * Leaves the home for a document that already exists, in whichever workspace holds it.
 *
 * No wait in between: while the home is up Dockview is not mounted at all, and entering another
 * workspace builds a fresh instance — `openDocument` queues what it is given until one
 * registers itself. See `dockview-api`.
 */
export function openExistingDocument(document: DocumentDescriptor): void {
  useLayouts.getState().setActiveWorkspace(document.workspace)
  openDocument(document)
}
