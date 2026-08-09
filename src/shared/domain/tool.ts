/**
 * Tool registry, shared by both processes. It lives in `shared/` because `{ id, zone }` is
 * domain data, not UI: the native menu needs it to restore a removed tool, and the renderer
 * enriches it with icons and components. Duplicating it in the main process would degrade
 * `ToolId` to `string` and force a cast back on the other side.
 */
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

export type ToolZone = 'left' | 'right' | 'top' | 'bottom'

export type ToolId =
  | 'layers'
  | 'meshes'
  | 'lights'
  | 'timeline'
  | 'explorer'
  | 'scene'
  | 'models'
  | 'generator'
  | 'inspector'
  | 'assets'
  | 'skybox'
  | 'channels'
  | 'view'

/**
 * The panels the LEFT column is reserved for: choosing a model, then filling its form. Nothing
 * else may sit there, and neither sits anywhere else — `tool.test.ts` enforces both directions.
 *
 * The whole column, not a half of it: generating is the one thing every space does, so it gets
 * the same place in all six, under the same button that creates a document.
 */
export const GENERATION_TOOLS: readonly ToolId[] = ['models', 'generator']

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
 * the asset shelf belongs in the bottom strip nearly everywhere, and in the column beside the
 * montage in Video and Audio, where dragging a take onto a track is the gesture the space is
 * built around.
 *
 * Two invariants hold across the placements of one tool, and `tool.test.ts` enforces them:
 * their workspaces never overlap, and they share a slot — a tool that changed half as well as
 * zone would land in a different row of the rail depending on where you came from.
 */
export type ToolPlacement = {
  id: ToolId
  zone: ToolZone
  slot: ToolSlot
  /** Workspaces the tool belongs to. Spelled out even when it is all of them: a panel that
   * never chose is a panel nobody decided about. */
  workspaces: readonly WorkspaceId[]
}

export const TOOL_SLOTS: readonly ToolSlot[] = ['primary', 'secondary']

/**
 * Tools sharing a zone AND a slot take turns; tools in different slots of the same zone show
 * together — stacked in a side column. A horizontal band has only a first half: it is read
 * across the whole width, and cutting it leaves two panels too narrow to be either.
 */
export const TOOL_PLACEMENTS: readonly ToolPlacement[] = [
  // The left column is generation, and only generation, in every space: the same two panels in
  // the same place, right under the button that makes a document.
  { id: 'models', zone: 'left', slot: 'primary', workspaces: WORKSPACE_IDS },
  { id: 'generator', zone: 'left', slot: 'primary', workspaces: WORKSPACE_IDS },

  // The upper right, in rail order. Every tool here takes its turn with the others its space
  // declares — the order below is the order their icons stack.
  //
  // The sky controls stay on the right rather than following the generator: they steer a
  // document that is already there, which is what the panels around them do.
  { id: 'skybox', zone: 'right', slot: 'primary', workspaces: ['skyboxes'] },
  // How the viewport is being looked at, never what it holds. Beside the sky's own controls
  // rather than under them: the centre carries the toolbar and the rulers, and a menu laid
  // over the picture covers the one thing the space exists to show.
  { id: 'view', zone: 'right', slot: 'primary', workspaces: ['skyboxes'] },
  { id: 'layers', zone: 'right', slot: 'primary', workspaces: ['image'] },
  // The eight channels of a material, first in Textures for the same reason the sky controls come
  // first in Skyboxes: it is what the space is for. In the column rather than the band, so a
  // channel and the shelf a picture is dragged from stay on screen together.
  { id: 'channels', zone: 'right', slot: 'primary', workspaces: ['textures'] },
  // Where a take is dragged onto a track, the shelf and the montage have to be on screen
  // together — and the montage owns the band, so the shelf takes the column.
  { id: 'assets', zone: 'right', slot: 'primary', workspaces: ['video', 'audio'] },
  { id: 'explorer', zone: 'right', slot: 'primary', workspaces: WORKSPACE_IDS },
  // The outliner of the scene, which the Explorer used to hold in this one workspace — it now
  // lists the documents of the project in all six, which is a different question.
  { id: 'scene', zone: 'right', slot: 'primary', workspaces: ['3d'] },
  { id: 'lights', zone: 'right', slot: 'primary', workspaces: ['3d'] },
  { id: 'meshes', zone: 'right', slot: 'primary', workspaces: ['3d'] },

  // The other half of the right column, and always up: what is selected is read WHILE a
  // model is chosen and a prompt written, and in an editor the inspector is never the panel
  // you have to switch away to.
  { id: 'inspector', zone: 'right', slot: 'secondary', workspaces: WORKSPACE_IDS },

  // The shelf belongs in the bottom band wherever the band is free: it is a shelf, read across
  // the width, and the column is where the things that act on the document live.
  {
    id: 'assets',
    zone: 'bottom',
    slot: 'primary',
    workspaces: ['image', '3d', 'textures', 'skyboxes'],
  },
  // The band is the montage's, across the whole width — that is how a montage is read, in Audio
  // as in Video.
  { id: 'timeline', zone: 'bottom', slot: 'primary', workspaces: ['video', 'audio'] },
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

export function servesWorkspace(placement: ToolPlacement, workspace: WorkspaceId): boolean {
  return placement.workspaces.includes(workspace)
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
