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

/**
 * Where a tool hangs. The bottom band is TWO zones sharing one height: whichever of them is alone
 * runs under the opposite column, and together they split the width between them.
 */
export type ToolZone = 'left' | 'right' | 'top' | 'bottomLeft' | 'bottomRight'

export type ToolId =
  | 'layers'
  | 'meshes'
  | 'lights'
  | 'timeline'
  | 'explorer'
  | 'git'
  | 'history'
  | 'scene'
  | 'models'
  | 'generator'
  | 'inspector'
  | 'assets'
  | 'channels'
  | 'styles'
  | 'projects'
  | 'library'
  | 'animations'

/**
 * The panels the upper half of a WORKSPACE's left column is reserved for: what the Scenario API
 * offers. A model to pick, its form to fill, and the assets the account holds. Nothing else may
 * sit in that half of a workspace, and none of the three sits anywhere else — `tool.test.ts`
 * enforces both directions, and both are scoped to `WORKSPACE_IDS`. The home is outside the rule
 * and always was: it calls no model, and its upper left holds the projects.
 *
 * The half used to be generation ALONE, and the shelf lay in the bottom band or the right column
 * depending on the space. What that arrangement said was "the shelf belongs to the document in
 * front of you", and it is the opposite of what the shelf is: nothing in it is in the project
 * until it is pulled down. Read together, the three answer one question — what can I get from
 * Scenario — and the half under them answers the other: what is already mine, on my disk.
 */
export const SCENARIO_TOOLS: readonly ToolId[] = ['models', 'generator', 'assets']

/**
 * A zone is cut in two, and each half shows one tool at a time. The rail draws the same cut as
 * a separator: icons above it open in the first half, icons below in the second.
 *
 * `primary` is the half nearest the window edge the zone hangs from — the top of a side column,
 * the left of the bottom strip.
 */
export type ToolSlot = 'primary' | 'secondary'

/**
 * Where a tool sits. A tool may declare **more than one**, for disjoint sets of surfaces: the
 * Explorer sits in the same half of every space and of the home, but only the home's asks for a
 * project first — a space is a project already being edited.
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
  /**
   * What has to exist for this placement to be offered at all — absent rather than disabled,
   * because neither is something the reader can act on from the rail.
   *
   * On the PLACEMENT rather than on the tool, and the Explorer is why: it needs a project on the
   * home, where offering it would say « no project open » beside the very shelf that opens one,
   * and needs nothing in a space, which is already a project being edited.
   *
   * The state itself is not answered here — `shared/` holds no runtime dependency — but which
   * question to ask is a property of the panel, and it belongs beside the panel.
   */
  requires?: 'project' | 'model'
}

export const TOOL_SLOTS: readonly ToolSlot[] = ['primary', 'secondary']

/**
 * Tools sharing a zone AND a slot take turns; tools in different slots of the same zone show
 * together — stacked in a side column. A horizontal band has only a first half: it is read
 * across the whole width, and cutting it leaves two panels too narrow to be either.
 */
export const TOOL_PLACEMENTS: readonly ToolPlacement[] = [
  // The upper half of the left column is the Scenario side, in every space: the same three
  // panels in the same place, right under the button that makes a document.
  { id: 'models', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },
  // Generating without a model is impossible, so it is absent rather than disabled.
  { id: 'generator', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS, requires: 'model' },
  // Last of the three, so entering a space still lands on the models: a half with nothing chosen
  // opens on the first tool it declares, and choosing a model is where every space starts.
  { id: 'assets', zone: 'left', slot: 'primary', surfaces: WORKSPACE_IDS },

  // The lower half: the documents to produce into. Its own half rather than a third turn in the
  // upper one, so the generator stays visible WHILE the Explorer is read.
  { id: 'explorer', zone: 'left', slot: 'secondary', surfaces: WORKSPACE_IDS },

  // The upper right, in rail order. Every tool here takes its turn with the others its space
  // declares — the order below is the order their icons stack.
  //
  { id: 'layers', zone: 'right', slot: 'primary', surfaces: ['image'] },
  // The eight channels of a material, first in Textures for the same reason the sky controls come
  // first in Skyboxes: it is what the space is for.
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
  // What a character can be made to play, on the right where the panels that steer a document
  // already are. Its rows are dragged onto the band below, which is why the two face each other.
  { id: 'animations', zone: 'right', slot: 'primary', surfaces: ['3d'] },

  // The other half of the right column, and always up: what is selected is read WHILE a
  // model is chosen and a prompt written, and in an editor the inspector is never the panel
  // you have to switch away to.
  { id: 'inspector', zone: 'right', slot: 'secondary', surfaces: WORKSPACE_IDS },

  // The band is the timeline's, across the whole width — that is how time is read, in Audio and
  // Video as in 3D, where an animation runs along the same line a montage does.
  { id: 'timeline', zone: 'bottomRight', slot: 'primary', surfaces: ['video', 'audio', '3d'] },

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
  // The halves are the same ones every space uses: the left is what one opens FROM, the right is
  // what one opens.
  //
  // The upper left, which the home alone leaves for something other than generation: it makes no
  // document, so the half goes to what one produces IN — the projects, the first thing anyone
  // comes to this screen for.
  { id: 'projects', zone: 'left', slot: 'primary', surfaces: [HOME_SURFACE] },

  // Under them, the project that is open, read as a folder. The same half it occupies in every
  // space, which is not a preference: `tool.test.ts` holds a tool to ONE slot across all of its
  // placements, so a panel that changed rows of the rail depending on where you came from is a
  // panel this registry cannot express.
  //
  // It replaces the flat list of documents this screen carried until 17 August. That list showed
  // the studio's own documents and nothing else; the folder holds them and everything the user
  // put beside them, which is what an entry point should offer a way into.
  //
  // Offered only while a project IS open: the panel would otherwise stand on the home saying
  // that nothing is open, beside the shelf whose whole purpose is to open one. Here and not on
  // the workspace placement above, a space being a project already being edited.
  {
    id: 'explorer',
    zone: 'left',
    slot: 'secondary',
    surfaces: [HOME_SURFACE],
    requires: 'project',
  },

  // The right column: what the account holds outside this project — a way into something, which
  // is what this screen is for.
  { id: 'library', zone: 'right', slot: 'primary', surfaces: [HOME_SURFACE] },

  // The project's own history, in the half the project's own FOLDER occupies — it answers about
  // the same files, and the two are read one after the other rather than side by side. Declared
  // last so the Explorer stays what an untouched half opens on, in every surface: the folder is
  // what one reaches for, and the versions are what one goes to look at.
  //
  // Every surface, and one placement rather than two: a tool is held to one slot across all of
  // its placements, and splitting these would only be a way of writing the same slot twice.
  //
  // Offered only while a project IS open, for the reason the Explorer gives above: what is
  // versioned is a project folder, and there is nothing to say about one that is not open. In a
  // space that is always true; on the home it is the whole point.
  {
    id: 'git',
    zone: 'left',
    slot: 'secondary',
    surfaces: [...WORKSPACE_IDS, HOME_SURFACE],
    requires: 'project',
  },

  // The versions themselves, in the band — where the timeline is, and for the same reason: both
  // are read ACROSS, one commit or one frame at a time, and a branch graph in a 280 px column is
  // a graph nobody can follow. The column beside it holds the files of whichever version is
  // picked, which is why the band and not a second column.
  //
  // Declared after the shelf and the montage, so entering a space still opens on the panel that
  // space is for. Someone who wants the history asks for it.
  //
  // The home as well, which reverses what this said until 17 August — and the argument it
  // reversed is worth keeping, because it still holds for the eight panels the home lost on
  // 13 August: a panel that answers a question about the studio stands between the reader and
  // their projects. The history is not one of those. It answers a question about the project
  // that is OPEN, it is offered only while one is (`requires`), and the Git panel already sits
  // in the home's left column saying what has changed — a reader who can see that and not what
  // came before it is reading half a sentence.
  {
    id: 'history',
    zone: 'bottomRight',
    slot: 'primary',
    surfaces: [...WORKSPACE_IDS, HOME_SURFACE],
    requires: 'project',
  },
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
 * placement was declared first, which for the Explorer is the one that asks for no project —
 * offered on the home, where there may not be one.
 */
export function placementIn(id: unknown, surface: ToolSurface): ToolPlacement | null {
  return placementsOf(id).find(placement => serves(placement, surface)) ?? null
}

export function serves(placement: ToolPlacement, surface: ToolSurface): boolean {
  return placement.surfaces.includes(surface)
}

export const TOOL_ZONES: readonly ToolZone[] = ['left', 'right', 'top', 'bottomLeft', 'bottomRight']

/** The band's two halves, in the order they are drawn. */
export const BOTTOM_ZONES: readonly ToolZone[] = ['bottomLeft', 'bottomRight']

/** Whether the zone is one of the band's halves, which share a height and a resize handle. */
export function isBottom(zone: ToolZone): boolean {
  return zone === 'bottomLeft' || zone === 'bottomRight'
}

/** Horizontal zones: their size is set as a height, not a width. */
export function isHorizontal(zone: ToolZone): boolean {
  return zone === 'top' || isBottom(zone)
}

/**
 * Zones whose panel sits before its resize handle. The opposite zones grow backwards, which
 * is also why their drag direction is inverted.
 */
export function isLeading(zone: ToolZone): boolean {
  return zone === 'left' || zone === 'top'
}
