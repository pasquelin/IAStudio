import { placementIn, type ToolId } from '@shared/domain/tool'
import { hasModelFor, shownTool } from '@/helpers/tool-registry'
import { useLayouts } from '@/stores/layouts'
import { useTools } from '@/stores/tools'

/**
 * Brings a panel forward, wherever this workspace puts it. The zone is resolved rather than
 * fixed: the shelf is the bottom band in Image and the right column in Video, and a half that
 * does not match its placement renders a different panel altogether.
 *
 * No placement means this workspace does not serve the tool — opening it would accent a rail
 * icon that is not drawn and show nothing.
 *
 * Already up is only focused, never rewritten: the half may be showing this panel because it is
 * the first one the section declares, and naming it would settle for all six sections a question
 * the click never asked.
 */
export function revealTool(tool: ToolId): void {
  const workspace = useLayouts.getState().activeWorkspace
  const placement = placementIn(tool, workspace)
  if (!placement) return

  const { zone, slot } = placement
  const tools = useTools.getState()
  const up = shownTool(tools.open[zone]?.[slot], zone, slot, workspace, hasModelFor(workspace))

  if (up === tool) tools.focus(zone)
  else tools.show(zone, tool)
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}
