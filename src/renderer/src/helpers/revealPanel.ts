import { placementIn, type ToolId, type ToolSurface } from '@shared/domain/tool'
import { shownTool, toolStateOf } from '@/helpers/toolRegistry'
import { toolSurface } from '@/stores/layouts'
import { arrangementOf, useTools } from '@/stores/tools'

/**
 * Brings a panel forward, wherever this surface puts it. The zone is resolved rather than
 * fixed: the upper left is the Scenario panels in every space and the projects on the home, the
 * band is the montage in three spaces and the history in the other three, and a half that does
 * not match its placement renders a different panel altogether.
 *
 * No placement means this surface does not serve the tool — opening it would accent a rail
 * icon that is not drawn and show nothing. Answered rather than ignored, for the one caller that
 * has to say so: an MCP client naming a panel the surface in front does not carry.
 *
 * Already up is only focused, never rewritten: the half may be showing this panel because it is
 * the first one the section declares, and naming it would settle for all six sections a question
 * the click never asked.
 */
export function revealTool(tool: ToolId): boolean {
  const surface = toolSurface()
  const placement = placementIn(tool, surface)
  if (!placement) return false

  const tools = useTools.getState()
  if (toolIsShown(tool, surface)) tools.focus(placement.zone)
  else tools.show(surface, placement.zone, tool)
  return true
}

/**
 * Whether this surface is showing that panel right now. A half that was never named shows the
 * first tool its placement declares, so the arrangement alone does not answer it.
 */
export function toolIsShown(tool: ToolId, surface: ToolSurface): boolean {
  const placement = placementIn(tool, surface)
  if (!placement) return false

  const { zone, slot } = placement
  const { open } = arrangementOf(useTools.getState(), surface)
  return shownTool(open[zone]?.[slot], zone, slot, surface, toolStateOf()) === tool
}

/**
 * The other half of the gesture, and it closes THIS panel or nothing.
 *
 * `close` empties a half whatever stands in it, and three panels share one in every space: asked
 * to close the shelf while the half shows the models, it closed the models and answered yes.
 */
export function closeTool(tool: ToolId): boolean {
  const surface = toolSurface()
  const placement = placementIn(tool, surface)
  if (!placement || !toolIsShown(tool, surface)) return false

  useTools.getState().close(surface, placement.zone, placement.slot)
  return true
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}
