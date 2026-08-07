/**
 * Tool registry, shared by both processes. It lives in `shared/` because `{ id, zone }` is
 * domain data, not UI: the native menu needs it to restore a removed tool, and the renderer
 * enriches it with icons and components. Duplicating it in the main process would degrade
 * `ToolId` to `string` and force a cast back on the other side.
 */
import type { WorkspaceId } from './workspace'

export type ToolZone = 'left' | 'right' | 'top' | 'bottom'

export type ToolId =
  | 'layers'
  | 'meshes'
  | 'lights'
  | 'timeline'
  | 'explorer'
  | 'models'
  | 'generator'
  | 'inspector'
  | 'assets'
  | 'jobs'

/**
 * A zone is cut in two, and each half shows one tool at a time. The rail draws the same cut as
 * a separator: icons above it open in the first half, icons below in the second.
 *
 * `primary` is the half nearest the window edge the zone hangs from — the top of a side column,
 * the left of the bottom strip.
 */
export type ToolSlot = 'primary' | 'secondary'

export type ToolPlacement = {
  id: ToolId
  zone: ToolZone
  slot: ToolSlot
  /** Workspaces the tool belongs to. Absent means every one of them. */
  workspaces?: readonly WorkspaceId[]
}

export const TOOL_SLOTS: readonly ToolSlot[] = ['primary', 'secondary']

/**
 * Tools sharing a zone AND a slot take turns; tools in different slots of the same zone show
 * together — stacked in a side column, side by side in a strip.
 */
export const TOOL_PLACEMENTS: readonly ToolPlacement[] = [
  { id: 'layers', zone: 'left', slot: 'primary', workspaces: ['image'] },
  { id: 'meshes', zone: 'left', slot: 'primary', workspaces: ['3d'] },
  { id: 'lights', zone: 'left', slot: 'primary', workspaces: ['3d'] },
  { id: 'explorer', zone: 'left', slot: 'secondary' },
  { id: 'models', zone: 'right', slot: 'primary' },
  { id: 'generator', zone: 'right', slot: 'primary' },
  // The other half of the right column: what is selected is read WHILE a model is chosen and a
  // prompt written, so the inspector shares the column rather than taking turns in it.
  { id: 'inspector', zone: 'right', slot: 'secondary' },
  // Same half as the asset shelf: a montage is read across the whole width, so the two take
  // turns rather than share the strip. First of the half, because in the Video workspace it is
  // what the strip is for.
  { id: 'timeline', zone: 'bottom', slot: 'primary', workspaces: ['video'] },
  { id: 'assets', zone: 'bottom', slot: 'primary' },
  { id: 'jobs', zone: 'bottom', slot: 'primary' },
]

/**
 * Takes `unknown` on purpose: it doubles as the guard for ids read back from persisted state,
 * where an entry left over from an older version must be dropped rather than trusted.
 */
export function placementOf(id: unknown): ToolPlacement | null {
  return TOOL_PLACEMENTS.find(placement => placement.id === id) ?? null
}

/** A tool with no `workspaces` belongs everywhere; one with a list belongs only to that list. */
export function servesWorkspace(placement: ToolPlacement, workspace: WorkspaceId): boolean {
  return placement.workspaces === undefined || placement.workspaces.includes(workspace)
}

export const TOOL_ZONES: readonly ToolZone[] = ['left', 'right', 'top', 'bottom']

/** Horizontal zones: their size is set as a height, not a width. */
export function isHorizontal(zone: ToolZone): boolean {
  return zone === 'top' || zone === 'bottom'
}

/**
 * Zones whose panel sits before its resize handle. The opposite zones grow backwards, which
 * is also why their drag direction is inverted.
 */
export function isLeading(zone: ToolZone): boolean {
  return zone === 'left' || zone === 'top'
}
