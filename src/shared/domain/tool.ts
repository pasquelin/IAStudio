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
  | 'skybox'

/**
 * A zone is cut in two, and each half shows one tool at a time. The rail draws the same cut as
 * a separator: icons above it open in the first half, icons below in the second.
 *
 * `primary` is the half nearest the window edge the zone hangs from — the top of a side column,
 * the left of the bottom strip.
 */
export type ToolSlot = 'primary' | 'secondary'

/**
 * Where a tool sits. A tool may declare **more than one**, for disjoint sets of workspaces:
 * the asset shelf belongs in the bottom strip nearly everywhere, and beside the montage in
 * Video and Audio, where dragging a take onto a track is the gesture the space is built around.
 *
 * Two invariants hold across the placements of one tool, and `tool.test.ts` enforces them:
 * their workspaces never overlap, and they share a slot — a tool that changed half as well as
 * zone would land in a different row of the rail depending on where you came from.
 */
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
  // The other half of the right column, and always up: what is selected is read WHILE a
  // model is chosen and a prompt written, and in an editor the inspector is never the panel
  // you have to switch away to.
  { id: 'inspector', zone: 'right', slot: 'secondary' },
  // The generator's half, not the inspector's. The inspector serves every space — a node, an
  // asset, a clip — so putting the sky controls beside it would make the two chase each other
  // out of the same half. Here they take turns with choosing a model, which is the other
  // moment of the same work.
  { id: 'skybox', zone: 'right', slot: 'primary', workspaces: ['skyboxes'] },
  // The shelf belongs in the bottom strip: it is a shelf, read across the width, and the side
  // column is where the things that act on the document live.
  {
    id: 'assets',
    zone: 'bottom',
    slot: 'primary',
    workspaces: ['image', '3d', 'textures', 'skyboxes'],
  },
  // Except where a take is dragged onto a track. There the shelf and the montage have to be on
  // screen together, and the montage already owns the strip — two panels taking turns in one
  // half cannot be dragged between.
  { id: 'assets', zone: 'right', slot: 'primary', workspaces: ['video', 'audio'] },
  // The strip is the montage's, across the whole width — that is how a montage is read.
  { id: 'timeline', zone: 'bottom', slot: 'primary', workspaces: ['video'] },
  // The other half of the strip, so it never takes the shelf's place: what is generating and
  // what has been generated are read together, not one instead of the other.
  { id: 'jobs', zone: 'bottom', slot: 'secondary' },
]

/**
 * Any placement of a tool, for the questions a workspace does not change — its slot, and
 * whether the id is one this version still knows.
 *
 * Takes `unknown` on purpose: it doubles as the guard for ids read back from persisted state,
 * where an entry left over from an older version must be dropped rather than trusted.
 */
export function placementOf(id: unknown): ToolPlacement | null {
  return TOOL_PLACEMENTS.find(placement => placement.id === id) ?? null
}

export function placementsOf(id: unknown): ToolPlacement[] {
  return TOOL_PLACEMENTS.filter(placement => placement.id === id)
}

/**
 * Where a tool sits **in this workspace**, or `null` if it does not serve it. This is what a
 * caller wants whenever it is about to open one: `placementOf` would answer with whichever
 * placement was declared first, which for the asset shelf is the wrong zone half the time.
 */
export function placementIn(id: unknown, workspace: WorkspaceId): ToolPlacement | null {
  return placementsOf(id).find(placement => servesWorkspace(placement, workspace)) ?? null
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
