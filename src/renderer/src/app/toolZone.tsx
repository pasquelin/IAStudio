import { createContext, type ReactNode } from 'react'
import type { ToolZone } from '@shared/domain/tool'

/**
 * The zone a panel is being rendered in. A panel that is the same in a 320 px column and in a
 * strip across the window is rare — a filter bar has to stack in one and lay out in the other —
 * and the asset shelf now appears in both, depending on the workspace.
 *
 * Read through `useToolLying` rather than guessing from the window width: the zone is what the
 * layout means, whereas a width is a consequence of it that a resize can make lie.
 */
export const ToolZoneContext = createContext<ToolZone | null>(null)

export function ToolZoneProvider({ zone, children }: { zone: ToolZone; children: ReactNode }) {
  return <ToolZoneContext value={zone}>{children}</ToolZoneContext>
}
