import type { ToolId } from '@shared/domain/tool'
import { toolZoneIn } from '@/helpers/tool-registry'
import { useLayouts } from '@/stores/layouts'
import { useTools } from '@/stores/tools'

/**
 * Brings a panel forward, wherever this workspace puts it. The zone is resolved rather than
 * fixed: the shelf is the bottom band in Image and the right column in Video, and a half that
 * does not match its placement renders a different panel altogether.
 *
 * `null` means this workspace does not serve the tool — opening it would accent a rail icon that
 * is not drawn and show nothing.
 */
export function revealTool(tool: ToolId): void {
  const zone = toolZoneIn(tool, useLayouts.getState().activeWorkspace)
  if (zone) useTools.getState().show(zone, tool)
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}
