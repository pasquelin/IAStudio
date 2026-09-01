import type { OpenByZone } from '@pasquelin/panels'
import { familyOf, type ToolId, type ToolSurface } from '@shared/domain/tool'
import { declarePanelsOf } from '@/features/shell/panelSpecs'
import { panelsStore } from './panels'

/**
 * A chassis holding nothing — `panelsStore` is a module singleton, so a test inherits the last.
 *
 * 🛑 Written rather than `reset()`: that one SETTLES the view in front against the registry it
 * finds, and a registry emptied first settles it EMPTY — a view that then has an entry, so
 * nothing re-opens it and every panel stays shut.
 */
export function resetChassis(): void {
  panelsStore.setState({
    registry: [],
    views: {},
    lengths: { sizes: {}, splits: {} },
    focusedZone: null,
    stashed: {},
    defaults: undefined,
    available: { width: 0, height: 0 },
  })
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
