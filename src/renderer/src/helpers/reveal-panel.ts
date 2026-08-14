import type { AssetType } from '@shared/domain/asset'
import { placementIn, type ToolId } from '@shared/domain/tool'
import { showWorkspace } from '@/app/dockview-api'
import { setFacetValue } from '@/helpers/collection-state'
import { hasModelFor, shownTool } from '@/helpers/tool-registry'
import { workspaceOfType } from '@/helpers/workspaces'
import { TYPE_FACET } from '@/panels/assets/type-facet'
import { useAssets } from '@/stores/assets'
import { toolSurface } from '@/stores/layouts'
import { arrangementOf, useTools } from '@/stores/tools'

/**
 * Brings a panel forward, wherever this surface puts it. The zone is resolved rather than
 * fixed: the shelf is the bottom band in Image and the right column in Video, the upper left is
 * the models in every space and the projects on the home, and a half that does not match its
 * placement renders a different panel altogether.
 *
 * No placement means this surface does not serve the tool — opening it would accent a rail
 * icon that is not drawn and show nothing.
 *
 * Already up is only focused, never rewritten: the half may be showing this panel because it is
 * the first one the section declares, and naming it would settle for all six sections a question
 * the click never asked.
 */
export function revealTool(tool: ToolId): void {
  const surface = toolSurface()
  const placement = placementIn(tool, surface)
  if (!placement) return

  const { zone, slot } = placement
  const tools = useTools.getState()
  const { open } = arrangementOf(tools, surface)
  const up = shownTool(open[zone]?.[slot], zone, slot, surface, hasModelFor(surface))

  if (up === tool) tools.focus(zone)
  else tools.show(surface, zone, tool)
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}

/**
 * Brings the shelf up narrowed to one kind, in the workspace that makes it.
 *
 * Beside `revealAssets` rather than in the home that asks for it: naming a facet and writing it
 * into the browser's state is the panel's own language, and the home has no business speaking
 * it. The kind IS the scope the shelf asks the catalogue and the library for, so a click on
 * "Skyboxes" shows every sky rather than the four kinds that space happens to accept.
 */
export function revealAssetsOfKind(type: AssetType): void {
  // `showWorkspace` rather than the store's setter, so the tab strip and the rail agree: the
  // centre holds every section at once, and a section chosen by hand brings its own tab forward.
  showWorkspace(workspaceOfType(type))

  const { collection, setCollection } = useAssets.getState()
  setCollection(setFacetValue(collection, TYPE_FACET, type))

  // After the workspace: the shelf lands wherever THAT space puts it.
  revealAssets()
}
