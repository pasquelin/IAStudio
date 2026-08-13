/**
 * Tool registry, shared by both processes. It lives in `shared/` because `{ id, zone }` is
 * domain data, not UI: the native menu needs it to restore a removed tool, and the renderer
 * enriches it with icons and components. Duplicating it in the main process would degrade
 * `ToolId` to `string` and force a cast back on the other side.
 */
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

/**
 * A surface panels can stand on: one of the workspaces, or the home screen.
 *
 * The home is deliberately NOT a `WorkspaceId`, and the criterion is what a workspace IS: a
 * place that opens documents of a kind of its own. The home opens the other spaces' documents
 * and makes none, so a workspace opening no document would be a fiction the union has to guard
 * against. It only ever needed to be a place a panel can sit, which is this and no more.
 */
export type ToolSurface = WorkspaceId | 'home'

export const HOME_SURFACE = 'home'

/**
 * Surfaces that share one arrangement of zones.
 *
 * The workspaces share theirs on purpose: what is open is stored per zone, so a shelf opened
 * in Image is still there in Video. The home shares with none — it never stands beside a
 * workspace, and its left column holds the Explorer where they hold generation. One state for
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
  | 'styles'
  | 'view'
  | 'projects'
  | 'library'
  | 'documents'

/**
 * The panels the upper half of a WORKSPACE's left column is reserved for: choosing a model, then
 * filling its form. Nothing else may sit in that half of a workspace, and neither sits anywhere
 * else — `tool.test.ts` enforces both directions, and both are scoped to `WORKSPACE_IDS`. The
 * home is outside the rule and always was: it generates nothing, and its upper left holds the
 * projects.
 *
 * The upper half of every space's left column, so generating — the one thing every space does —
 * keeps the same place in each, under the same button that creates a document. The half below
 * is the Explorer, which is what makes the whole column "where one produces".
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
  // The upper half of the left column is generation, and only generation, in every space: the
  // same two panels in the same place, right under the button that makes a document.
  { id: 'models', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },
  { id: 'generator', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },

  // The lower half: the documents to produce into. A half rather than more turns in the upper
  // one — two halves of two keep the generator visible WHILE the Explorer is read.
  { id: 'explorer', zone: 'left', slot: 'secondary', surfaces: WORKSPACE_IDS },

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
  // Saved ways of reading a material, beside the channels they read. In the upper half so the
  // inspector keeps the lower one: a style is saved FROM the inspector, and a panel that took
  // its place would hide the settings one is capturing at the moment of capturing them.
  { id: 'styles', zone: 'right', slot: 'primary', surfaces: ['textures'] },
  // The outliner of the scene, which the Explorer used to hold in this one workspace — it now
  // lists the documents of the project in every space, which is a different question.
  { id: 'scene', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  { id: 'lights', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  { id: 'meshes', zone: 'right', slot: 'primary', surfaces: ['3d'] },
  // Where a take is dragged onto a track, the shelf and the montage have to be on screen
  // together — and the montage owns the band, so the shelf takes the column. 3D joined them
  // when its own timeline did: the rule is the band's, not the montage's.
  //
  // Declared AFTER the three 3D panels, and it matters: a half with nothing chosen shows the
  // first tool it declares, so a shelf listed above them would open in front of the outliner
  // every time the space is entered.
  { id: 'assets', zone: 'right', slot: 'primary', surfaces: ['video', 'audio', '3d'] },

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
    surfaces: ['image', 'textures', 'skyboxes'],
  },
  // The band is the timeline's, across the whole width — that is how time is read, in Audio and
  // Video as in 3D, where an animation runs along the same line a montage does.
  { id: 'timeline', zone: 'bottom', slot: 'primary', surfaces: ['video', 'audio', '3d'] },

  // The home's own, and they serve it ALONE — a column beside an editor is for what acts on what
  // is in front of you, and each of these reads the studio rather than a document.
  //
  // THREE, where there were eleven until 13 August. The eight that went were readings of the
  // studio nobody came to this screen for: what an account had spent, how many assets it held by
  // kind, the newest ones it made, favourites, ideas, look-alikes, and two journals the status bar
  // already carries. The home is an entry point — where one comes to open something — and every
  // panel that answered a question instead of offering a way in was a panel between the reader
  // and the projects.
  //
  // What that leaves is one half per column, and the halves are the same ones every space uses:
  // the left is what one opens FROM, the right is what one opens. No `secondary` on this surface
  // at all, which is why `tool.test.ts` scopes the "both halves are used" checks to the
  // workspaces — a rail with one row and no separator is the honest drawing of one half.
  //
  // The upper left, which the home alone leaves for something other than generation: it makes no
  // document, so the half goes to what one produces IN — the projects, the first thing anyone
  // comes to this screen for, and now the only thing this column offers.
  { id: 'projects', zone: 'left', slot: 'primary', surfaces: [HOME_SURFACE] },

  // The right column, in rail order: what the account holds outside this project, then the
  // documents inside it. Two ways into something, which is what this screen is for.
  { id: 'library', zone: 'right', slot: 'primary', surfaces: [HOME_SURFACE] },
  { id: 'documents', zone: 'right', slot: 'primary', surfaces: [HOME_SURFACE] },
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
 * The placements a workspace can show — every one that reaches a workspace at all.
 *
 * What is open is stored once per zone, for all six spaces, so a tool open in one of its zones
 * is opened in the others: the shelf must not go missing on the way from Image to Video. A
 * placement that serves the home ALONE is not in that game — the home never shares the screen
 * with a workspace, and propagating a half it named would take a column the spaces use for
 * something else. A placement serving both, as the Explorer's does, belongs to both.
 */
export function workspacePlacementsOf(id: unknown): ToolPlacement[] {
  return placementsOf(id).filter(placement =>
    placement.surfaces.some(surface => surface !== HOME_SURFACE),
  )
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
