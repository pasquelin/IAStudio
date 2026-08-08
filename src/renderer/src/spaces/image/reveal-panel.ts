import { TOOL_ZONES, type ToolId, type ToolZone } from '@shared/domain/tool'
import { toolZoneIn } from '@/helpers/tool-registry'
import { useLayouts } from '@/stores/layouts'
import { useTools, type OpenByZone } from '@/stores/tools'

/**
 * The zone already showing a tool, or `null` when none is. Where the user put it wins: opening
 * a second copy elsewhere would answer a click by rearranging their layout.
 */
function zoneShowing(open: OpenByZone, tool: ToolId): ToolZone | null {
  return TOOL_ZONES.find(zone => Object.values(open[zone] ?? {}).includes(tool)) ?? null
}

/**
 * Brings a panel forward, wherever this workspace puts it. The zone is resolved rather than
 * fixed: the shelf is the bottom band in Image and the left column in Video, and a half that
 * does not match its placement renders a different panel altogether.
 */
export function revealTool(tool: ToolId): void {
  const tools = useTools.getState()
  const zone = toolZoneIn(tool, useLayouts.getState().activeWorkspace)
  if (!zone) return

  if (zoneShowing(tools.open, tool) === zone) tools.focus(zone)
  else tools.show(zone, tool)
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}
