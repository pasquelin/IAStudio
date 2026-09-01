import type { OpenByZone } from '@pasquelin/panels'
import { familyOf, type ToolId, type ToolSurface } from '@shared/domain/tool'
import type { ToolState } from '@/helpers/toolRegistry'
import { declarePanelsOf, panelSpecsOf } from '@/features/shell/panelSpecs'
import { LAYOUT_KEY } from '@/features/shell/layoutStorage'
import { panelsStore } from './panels'

/**
 * A chassis holding nothing — `panelsStore` is a module singleton, so a test inherits the last.
 * 🛑 Not `reset()`: that one SETTLES the view in front against the registry it finds, and a
 * registry emptied first settles it EMPTY, which nothing re-opens.
 */
export function resetChassis(): void {
  // A `<Shell>` mounted after another one wrote its arrangement would restore it instead of
  // settling, and the two tests would describe the same window.
  globalThis.localStorage?.removeItem(LAYOUT_KEY)
  panelsStore.setState(panelsStore.getInitialState())
}

/**
 * The chassis as `<Shell>` would have set it up for that surface, without mounting it.
 *
 * Named an arrangement, it is taken as the reader's own; left out, the halves are settled the
 * way a first launch settles them. Call it after the stores a `requires` reads are set.
 */
export function chassisFor(surface: ToolSurface, open?: OpenByZone<ToolId>): void {
  resetChassis()
  if (open !== undefined) panelsStore.setState({ views: { [familyOf(surface)]: open } })
  declarePanelsOf(surface)
}

/**
 * The same chassis, told what the studio holds rather than reading it — the panels a surface
 * offers are the answers to a `ToolState`, and a test that names it says which case it is about.
 */
export function chassisOffering(
  surface: ToolSurface,
  state: ToolState,
  open?: OpenByZone<ToolId>,
): void {
  resetChassis()
  if (open !== undefined) panelsStore.setState({ views: { [familyOf(surface)]: open } })

  const chassis = panelsStore.getState()
  chassis.declare(panelSpecsOf(surface, state, id => id))
  chassis.setView(familyOf(surface))
  chassis.settle()
}
