import type { ToolZone } from '@shared/domain/tool'
import { shownTools, type ShownTools } from '@/helpers/toolRegistry'
import { useToolSurface } from '@/stores/layouts'
import { arrangementOf, useTools } from '@/stores/tools'
import { useToolState } from './useToolState'

/**
 * What a zone actually DRAWS, which is not what it holds: a half may be open on a panel this
 * surface does not offer, one that draws nothing takes no room at all, and a `solo` panel takes
 * the zone whole.
 *
 * A hook rather than `ShellEdge`'s own reading, because the SHELL asks it too: which of the
 * band's halves draws anything is what decides the whole frame's arrangement.
 */
export function useShownTools(zone: ToolZone): ShownTools {
  const surface = useToolSurface()
  const slots = useTools(state => arrangementOf(state, surface).open[zone])
  const state = useToolState()

  return shownTools(slots, zone, surface, state)
}

/** Whether the zone draws at all — an empty one takes neither room nor handle. */
export function isZoneShown(shown: ShownTools): boolean {
  return Boolean(shown.primary ?? shown.secondary)
}
