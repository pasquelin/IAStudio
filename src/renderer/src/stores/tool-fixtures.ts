import { familyOf, type SurfaceFamily, type ToolSurface } from '@shared/domain/tool'
import { DEFAULT_ARRANGEMENTS, type Arrangement } from './tools'

/**
 * One surface's arrangement, every other family left on its default.
 *
 * A test that sets `open` alone was written when the studio held a single arrangement for the
 * whole window. Naming the surface is what replaced it — and saying it out loud is the point:
 * the home and the spaces both use the left column, for different panels.
 */
export function arrangedFor(
  surface: ToolSurface,
  arrangement: Partial<Arrangement>,
): Record<SurfaceFamily, Arrangement> {
  const empty: Arrangement = { open: {}, sizes: {}, splits: {} }
  const family = familyOf(surface)

  return {
    ...DEFAULT_ARRANGEMENTS,
    [family]: { ...empty, ...arrangement },
  }
}
