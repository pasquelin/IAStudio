import { createContext, use, type ReactNode } from 'react'
import { isHorizontal, type ToolZone } from '@shared/domain/tool'

/**
 * The zone a panel is being rendered in. A panel that is the same in a 320 px column and in a
 * strip across the window is rare — a filter bar has to stack in one and lay out in the other —
 * and the asset shelf now appears in both, depending on the workspace.
 *
 * Read through `useToolLying` rather than guessing from the window width: the zone is what the
 * layout means, whereas a width is a consequence of it that a resize can make lie.
 */
const ToolZoneContext = createContext<ToolZone | null>(null)

export function ToolZoneProvider({ zone, children }: { zone: ToolZone; children: ReactNode }) {
  return <ToolZoneContext value={zone}>{children}</ToolZoneContext>
}

/**
 * Whether the panel lies across the window rather than standing beside it. `false` outside a
 * tool window — a panel rendered in a test or a dialog is treated as a column, which is the
 * shape every panel was written for first.
 */
export function useToolLying(): boolean {
  const zone = use(ToolZoneContext)
  return zone !== null && isHorizontal(zone)
}
