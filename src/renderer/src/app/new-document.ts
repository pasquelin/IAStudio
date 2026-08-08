import { kindForWorkspace } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { openDocument } from './dockview-api'

/**
 * Makes a blank document in a workspace and puts it in front.
 *
 * Its own file because two surfaces ask for it — the rail's plus button and the home's tools —
 * and the two copies had already started to differ. Deliberately away from `document-io`, which
 * reaches every engine: the rail must not import three megabytes to open an empty canvas.
 *
 * A folder gone read-only, or removed under us, leaves the workspace empty rather than failing
 * loudly: that is the honest outcome, and the studio has nowhere to say more until it grows a
 * notification.
 */
export function createDocumentIn(workspace: WorkspaceId): void {
  if (kindForWorkspace(workspace) === null || !useProject.getState().project) return

  void useDocuments
    .getState()
    .create(workspace)
    .then(created => created && openDocument(created))
    .catch(() => {})
}
