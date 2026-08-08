import type { WorkspaceId } from '@shared/domain/workspace'
import { kindForWorkspace, type DocumentDescriptor } from '@shared/domain/document'
import { openDocument } from '@/app/dockview-api'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'

/**
 * Leaves the home for a workspace, on a blank document when there is a project to write one in.
 *
 * The same two steps the rail's plus button takes, in one place: the home offers six ways in,
 * and six copies of "switch, then create, then open the tab" would drift.
 */
export function enterWorkspace(workspace: WorkspaceId): void {
  // Before the create: switching is what closes the home, and the new tab has to land in the
  // Dockview the workspace being entered owns.
  useLayouts.getState().setActiveWorkspace(workspace)

  const project = useProject.getState().project
  if (!project || kindForWorkspace(workspace) === null) return

  void useDocuments
    .getState()
    .create(workspace)
    .then(created => created && openDocument(created))
    // A folder gone read-only, or removed under us: the workspace still opens, empty, which is
    // the honest outcome — and the same one the rail settles for.
    .catch(() => {})
}

/**
 * Leaves the home for a document that already exists, in whichever workspace holds it.
 *
 * The frame in between is not decorative: while the home is up, Dockview is not mounted at all,
 * and it is keyed by workspace, so entering another one builds a fresh instance. `openDocument`
 * reaches for whichever instance last registered itself — called straight after the switch, it
 * would hand the tab to one that is being thrown away, or to none.
 */
export function openExistingDocument(document: DocumentDescriptor): void {
  useLayouts.getState().setActiveWorkspace(document.workspace)
  requestAnimationFrame(() => openDocument(document))
}
