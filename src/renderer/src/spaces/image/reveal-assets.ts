import { TOOL_ZONES, type ToolId, type ToolSlot, type ToolZone } from '@shared/domain/tool'
import { useTools } from '@/stores/tools'

/**
 * The zone already showing the shelf, or `null` when none is. Where the user put it wins:
 * opening a second copy in the default corner would answer a click by moving their layout.
 */
export function zoneShowing(
  open: Partial<Record<ToolZone, Partial<Record<ToolSlot, ToolId>>>>,
  tool: ToolId,
): ToolZone | null {
  return TOOL_ZONES.find(zone => Object.values(open[zone] ?? {}).includes(tool)) ?? null
}

/**
 * Brings the asset shelf forward. Placing a picture is choosing one, and the shelf is where
 * pictures are chosen — the canvas has no file dialog of its own, and the renderer has no
 * filesystem to open one against.
 */
export function revealAssets(): void {
  const tools = useTools.getState()
  const zone = zoneShowing(tools.open, 'assets')

  if (zone) tools.focus(zone)
  else tools.show('left', 'assets')
}
