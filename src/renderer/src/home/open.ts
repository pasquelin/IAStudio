import type { AssetType } from '@shared/domain/asset'
import type { WorkspaceId } from '@shared/domain/workspace'
import { createDocumentIn } from '@/app/new-document'
import { setFacetValue } from '@/helpers/collection-state'
import { revealTool } from '@/helpers/reveal-panel'
import { workspaceOfType } from '@/helpers/workspaces'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { TYPE_FACET } from '@/panels/assets/type-facet'

/**
 * Leaves the home for a workspace, on a blank document when there is a project to write one in.
 *
 * Opening a document that already exists needs nothing of its own: `openDocument` switches to
 * whichever workspace owns it and queues the panel until that Dockview reports itself — which
 * is exactly the gap the home opens by covering the centre.
 */
export function enterWorkspace(workspace: WorkspaceId): void {
  useLayouts.getState().setActiveWorkspace(workspace)
  createDocumentIn(workspace)
}

/**
 * Leaves the home for the shelf, narrowed to one kind.
 *
 * No blank document, unlike above: going to look at what one already has is not starting
 * something new, and an "Untitled 1" tab per counter clicked would be litter.
 *
 * The shelf reads the facet on its way up and drops its own workspace scope when it finds one —
 * so a click on "Skyboxes" shows every sky, not the ones the space in front happens to accept.
 */
export function browseKind(type: AssetType): void {
  useLayouts.getState().setActiveWorkspace(workspaceOfType(type))

  const { collection, setCollection } = useAssets.getState()
  setCollection(setFacetValue(collection, TYPE_FACET, type))

  // After the workspace: the shelf lands wherever THAT space puts it.
  revealTool('assets')
}
