import { shownIn } from '@pasquelin/panels'
import { placementIn, type ToolId, type ToolZone } from '@shared/domain/tool'
import { offeredPlacement, toolStateOf } from '@/helpers/toolRegistry'
import { toolSurface } from '@/stores/layouts'
import { panelsStore } from '@/stores/panels'

/**
 * Brings a panel forward, wherever this surface puts it. The zone is resolved by the chassis
 * rather than fixed here: the upper left is the Scenario panels in every space and the projects
 * on the home, and the band is the montage in three spaces and the history in the other three.
 *
 * 🛑 OFFERED, not merely placed: a panel withheld by its `requires` is not DECLARED to the
 * chassis at all, so `show` would find nothing and say nothing. Answered rather than ignored,
 * for the one caller that has to say so: an MCP client naming a panel the surface in front does
 * not carry.
 *
 * Already up is only focused, never rewritten — the chassis holds that rule itself: a half may
 * be showing this panel because it is the first one declared, and naming it would settle for
 * every other surface a question the click never asked.
 */
export function revealTool(tool: ToolId): boolean {
  if (!offeredPlacement(tool, toolSurface(), toolStateOf())) return false

  panelsStore.getState().show(tool)
  // The same answer `panels.list` gives, rather than the call having been made: `offeredPlacement`
  // reads the stores while the registry follows the shell's render, so the two are a tick apart
  // whenever an answer has just landed — and `show` does nothing for an id it cannot find.
  return toolIsShown(tool)
}

/**
 * Whether the surface IN FRONT is showing that panel right now. A half that was never named shows
 * the first panel its surface declares, so the arrangement alone does not answer it.
 *
 * 🛑 No surface to ask about: what the chassis draws is what the view in front holds, resolved
 * against the registry the shell declared for it. Taking one made the answer look addressable.
 */
export function toolIsShown(tool: ToolId): boolean {
  const placement = placementIn(tool, toolSurface())
  if (!placement) return false

  return isShown(tool, placement.zone)
}

/** What the zone DRAWS, which is not what it holds — the chassis resolves the fallback. */
function isShown(tool: ToolId, zone: ToolZone): boolean {
  const shown = shownIn(panelsStore.getState(), zone)
  return shown.primary === tool || shown.secondary === tool
}

/**
 * The other half of the gesture, and it closes THIS panel or nothing.
 *
 * The store's own `close(zone, slot)` empties a half whatever stands in it, and three panels
 * share one in every space: asked to close the shelf while the half shows the models, it closed
 * the models and answered yes.
 */
export function closeTool(tool: ToolId): boolean {
  const surface = toolSurface()
  const placement = placementIn(tool, surface)
  if (!placement || !isShown(tool, placement.zone)) return false

  panelsStore.getState().close(placement.zone, placement.slot)
  return true
}

/**
 * Placing a picture is choosing one, and the shelf is where pictures are chosen — the canvas has
 * no file dialog of its own, and the renderer has no filesystem to open one against.
 */
export function revealAssets(): void {
  revealTool('assets')
}
