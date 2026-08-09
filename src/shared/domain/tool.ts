/**
 * Tool registry, shared by both processes. It lives in `shared/` because `{ id, zone }` is
 * domain data, not UI: the native menu needs it to restore a removed tool, and the renderer
 * enriches it with icons and components. Duplicating it in the main process would degrade
 * `ToolId` to `string` and force a cast back on the other side.
 */
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

/**
 * A surface panels can stand on: one of the six workspaces, or the home screen.
 *
 * The home is deliberately NOT a seventh `WorkspaceId` — that union drives the document kinds
 * and the workspace menu, and a workspace opening no document would be a fiction both have to
 * guard against. It only ever needed to be a place a panel can sit, which is this and no more.
 */
export type ToolSurface = WorkspaceId | 'home'

export const HOME_SURFACE = 'home'

/**
 * Surfaces that share one arrangement of zones.
 *
 * The six workspaces share theirs on purpose: what is open is stored per zone, so a shelf opened
 * in Image is still there in Video. The home shares with none — it never stands beside a
 * workspace, and its left column holds the Explorer where the six hold generation. One state for
 * both would make closing the Explorer close the Models panel, and naming it overwrite the panel
 * the user had named there.
 */
export type SurfaceFamily = 'workspaces' | 'home'

export const SURFACE_FAMILIES: readonly SurfaceFamily[] = ['workspaces', 'home']

export function familyOf(surface: ToolSurface): SurfaceFamily {
  return surface === HOME_SURFACE ? 'home' : 'workspaces'
}

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
  | 'apps'

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
 * Where a tool sits. A tool may declare **more than one**, for disjoint sets of surfaces:
 * the asset shelf belongs in the bottom strip nearly everywhere, and in the column beside the
 * montage in Video and Audio, where dragging a take onto a track is the gesture the space is
 * built around.
 *
 * Two invariants hold across the placements of one tool, and `tool.test.ts` enforces them:
 * their surfaces never overlap, and they share a slot — a tool that changed half as well as
 * zone would land in a different row of the rail depending on where you came from.
 */
export type ToolPlacement = {
  id: ToolId
  zone: ToolZone
  slot: ToolSlot
  /** Surfaces the tool belongs to. Spelled out even when it is all of them: a panel that
   * never chose is a panel nobody decided about. */
  surfaces: readonly ToolSurface[]
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
  { id: 'models', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },
  { id: 'generator', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },

  // The home has no document to generate into, so the left column is free there — and the
  // documents are what one opens the studio to reach. Same panel and same half as in the six
  // spaces, one column over: the home offers no right-hand column for it to keep.
  { id: 'explorer', zone: 'left', slot: 'primary', surfaces: [HOME_SURFACE] },

  // The upper right, in rail order. Every tool here takes its turn with the others its space
  // declares — the order below is the order their icons stack.
  //
  // The sky controls stay on the right rather than following the generator: they steer a
  // document that is already there, which is what the panels around them do.
  { id: 'skybox', zone: 'right', slot: 'primary', surfaces: ['skyboxes'] },
  // How the viewport is being looked at, never what it holds. Beside the sky's own controls
  // rather than under them: the centre carries the toolbar and the rulers, and a menu laid
  // over the picture covers the one thing the space exists to show.
  { id: 'view', zone: 'right', slot: 'primary', surfaces: ['skyboxes'] },
  { id: 'layers', zone: 'right', slot: 'primary', surfaces: ['image'] },
  // The eight channels of a material, first in Textures for the same reason the sky controls come
  // first in Skyboxes: it is what the space is for. In the column rather than the band, so a
  // channel and the shelf a picture is dragged from stay on screen together.
  { id: 'channels', zone: 'right', slot: 'primary', surfaces: ['textures'] },
  // Where a take is dragged onto a track, the shelf and the montage have to be on screen
  // together — and the montage owns the band, so the shelf takes the column.
  { id: 'assets', zone: 'right', slot: 'primary', surfaces: ['video', 'audio'] },
  { id: 'explorer', zone: 'right', slot: 'primary', surfaces: WORKSPACE_IDS },
  // The outliner of the scene, which the Explorer used to hold in this one workspace — it now
  // lists the documents of the project in all six, which is a different question.
  { id: 'scene', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  { id: 'lights', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  { id: 'meshes', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  // Scenario's Apps — public workflows, run as they are. In the right column and not in the
  // left one, which is reserved for the two generation panels: an App is a pipeline of its own,
  // not a model the generator would fill a form for. Last of the half in every space, so it
  // takes the place of nothing: what a space opens on is what it declares first here.
  { id: 'apps', zone: 'right', slot: 'primary', surfaces: WORKSPACE_IDS },

  // The other half of the right column, and always up: what is selected is read WHILE a
  // model is chosen and a prompt written, and in an editor the inspector is never the panel
  // you have to switch away to.
  { id: 'inspector', zone: 'right', slot: 'secondary', surfaces: WORKSPACE_IDS },

  // The shelf belongs in the bottom band wherever the band is free: it is a shelf, read across
  // the width, and the column is where the things that act on the document live.
  {
    id: 'assets',
    zone: 'bottom',
    slot: 'primary',
    surfaces: ['image', '3d', 'textures', 'skyboxes'],
  },
  // The band is the montage's, across the whole width — that is how a montage is read, in Audio
  // as in Video.
  { id: 'timeline', zone: 'bottom', slot: 'primary', surfaces: ['video', 'audio'] },
]

/**
 * Any placement of a tool, for the questions a surface does not change — its slot, and
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
 * The placements a workspace can show — every one of them but the home's.
 *
 * What is open is stored once per zone, for all six spaces, so a tool open in one of its zones
 * is opened in the others: the shelf must not go missing on the way from Image to Video. The
 * home is not in that game. It never shares the screen with a workspace, and the Explorer stands
 * in its left column while the six put generation there — propagated, it would take the column
 * the user had named the Models panel for.
 */
export function workspacePlacementsOf(id: unknown): ToolPlacement[] {
  return placementsOf(id).filter(placement => !serves(placement, HOME_SURFACE))
}

/**
 * Where a tool sits **on this surface**, or `null` if it does not serve it. This is what a
 * caller wants whenever it is about to open one: `placementOf` would answer with whichever
 * placement was declared first, which for the asset shelf is the wrong zone half the time.
 */
export function placementIn(id: unknown, surface: ToolSurface): ToolPlacement | null {
  return placementsOf(id).find(placement => serves(placement, surface)) ?? null
}

export function serves(placement: ToolPlacement, surface: ToolSurface): boolean {
  return placement.surfaces.includes(surface)
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
