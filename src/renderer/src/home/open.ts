import type { WorkspaceId } from '@shared/domain/workspace'
import { createDocumentIn } from '@/app/newDocument'
import { useLayouts } from '@/stores/layouts'

/**
 * Leaves the home for a workspace, on a blank document when there is a project to write one in.
 *
 * Opening a document that already exists needs nothing of its own: `openDocument` switches to
 * whichever workspace owns it and queues the panel until that Dockview reports itself — which
 * is exactly the gap the home opens by covering the centre.
 */
export function enterWorkspace(workspace: WorkspaceId): void {
  useLayouts.getState().setActiveWorkspace(workspace)
  // What it answers is for a caller waiting on the other side of the window; here the field and
  // the tab it opens ARE the answer.
  void createDocumentIn(workspace)
}
