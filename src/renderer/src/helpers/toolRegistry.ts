import {
  mdiCloudOutline,
  mdiRunFast,
  mdiCreationOutline,
  mdiCubeScan,
  mdiFileTreeOutline,
  mdiFolderMultipleOutline,
  mdiFolderOutline,
  mdiFormatText,
  mdiHistory,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiSourceBranch,
  mdiTuneVariant,
  mdiVideoVintage,
} from '@mdi/js'
import {
  placementIn,
  serves,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolSlot,
  type ToolSurface,
  type ToolZone,
} from '@shared/domain/tool'
import { gitHoldsFolder } from '@shared/domain/git'
import { NODE_KINDS } from '@/engines/scene/nodeKinds'
import { useGit } from '@/stores/git'
import { useProject } from '@/stores/project'
import { modelForFamily } from './modelForFamily'
import { familyOfSurface } from './workspaces'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
  slot: ToolSlot
  surfaces: readonly ToolSurface[]
}

const ICONS: Record<ToolId, string> = {
  layers: mdiLayersOutline,
  // From the scene registry: the rail icon and the panel's own empty state must not drift.
  meshes: NODE_KINDS.mesh.icon,
  lights: NODE_KINDS.light.icon,
  timeline: mdiVideoVintage,
  explorer: mdiFolderOutline,
  // The fork every version tool draws, and the one glyph nobody mistakes for a folder.
  git: mdiSourceBranch,
  // The same subject read as a line of time, which is what the band holds — and a glyph that is
  // neither the fork above it nor the film reel the montage wears.
  history: mdiHistory,
  scene: mdiFileTreeOutline,
  models: mdiCubeScan,
  generator: mdiCreationOutline,
  inspector: mdiTuneVariant,
  assets: mdiImageMultipleOutline,
  // The home's own. `mdiFolderOutline` is the Explorer's and `mdiCreationOutline` the
  // generator's: a rail where two glyphs mean two things is a rail one reads twice.
  projects: mdiFolderMultipleOutline,
  library: mdiCloudOutline,
  animations: mdiRunFast,
  text: mdiFormatText,
}

/**
 * Tool windows, IDE-style: they live on the edges, one per half of a zone at a time, and are
 * picked from the icon rail. Only the center carries tabs — those are documents, and a document has
 * a name; a tool has an icon.
 *
 * Placements come from the shared registry; this module only adds what needs `@mdi/js`.
 */
export const TOOLS: readonly Tool[] = TOOL_PLACEMENTS.map(placement => ({
  ...placement,
  icon: ICONS[placement.id],
}))

/** Indexed once: `TOOLS` never changes, so filtering it on every render is pure waste. */
const BY_ZONE = TOOLS.reduce<Record<ToolZone, Tool[]>>(
  (index, tool) => {
    index[tool.zone].push(tool)
    return index
  },
  { left: [], right: [], top: [], bottomLeft: [], bottomRight: [] },
)

/**
 * The tools of a zone that the surface actually has. A layer stack means nothing in the audio
 * space: its icon has no business sitting in that rail, and its panel none being restored there
 * by a layout arranged elsewhere.
 */
export function toolsInZone(zone: ToolZone, surface: ToolSurface): Tool[] {
  return BY_ZONE[zone].filter(tool => serves(tool, surface))
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

/**
 * A tool's glyph, for the panel itself rather than for the rail.
 *
 * Exported so an empty state can wear the icon its rail button wears: the two drifting apart is
 * what `meshes` reading `NODE_KINDS.mesh.icon` above already guards against, one panel at a time.
 */
export function toolIcon(id: ToolId): string {
  return ICONS[id]
}

/** The answers the shared registry cannot give: they depend on state, which `shared/` cannot read. */
export function toolStateOf(surface: ToolSurface): ToolState {
  const family = familyOfSurface(surface)
  return {
    hasModel: Boolean(family && modelForFamily(family)),
    hasProject: useProject.getState().project !== null,
    hasGit: gitHoldsFolder(useGit.getState().repository),
  }
}

/** What a surface can offer beyond what the registry declares, each rule answered from a store. */
export type ToolState = {
  /** A model to generate with: one chosen in the Models panel, or one preferred in the settings. */
  hasModel: boolean
  /** A project folder open, which is what the Explorer reads. */
  hasProject: boolean
  /** Git holding the project folder, so there are versions to read. Kept honest by the shell. */
  hasGit: boolean
}

/**
 * Whether a section can offer this panel at all.
 *
 * WHAT each placement needs is declared beside it, in the registry; this only answers whether the
 * studio has it. Written as a run of `if (id === …)` it grew a third arm within a week of the
 * second, each of them a rule about a panel sitting a file away from where the panel is declared.
 */
function canOffer(id: ToolId, surface: ToolSurface, state: ToolState): boolean {
  const requires = placementIn(id, surface)?.requires

  if (requires === 'model') return state.hasModel
  if (requires === 'project') return state.hasProject
  // `git` implies `project`, and the conjunction is not redundant: the repository is corrected
  // asynchronously, so a project just closed still reads `ready` until the next status lands.
  if (requires === 'git') return state.hasProject && state.hasGit
  return true
}

/**
 * `undefined` for a closed half, `null` for one open on no panel in particular, an id for one the
 * user chose. Three substitutions — an unchosen half falls to the section's first panel, a half
 * holding a tool the section puts elsewhere shows what it does put there, a generator with no
 * model gives way to Models — and none of them touches the persisted state.
 */
export function shownTool(
  tool: ToolId | null | undefined,
  zone: ToolZone,
  slot: ToolSlot,
  surface: ToolSurface,
  state: ToolState,
): ToolId | null {
  if (tool === undefined) return null
  if (tool === null) return firstToolIn(zone, slot, surface, state)

  // Zone AND half: a stored id that names neither is not this half's business, whether it
  // belongs to the other column, the other half, or to a band no placement ever cuts.
  const placement = placementIn(tool, surface)
  if (placement?.zone === zone && placement.slot === slot) {
    // The half falls back to what the section does put there rather than to the Models panel,
    // which the home does not have at all — it stood empty on a home with no project open.
    return canOffer(tool, surface, state) ? tool : firstToolIn(zone, slot, surface, state)
  }

  return firstToolIn(zone, slot, surface, state)
}

/** The panel a section puts first in a half — what an unchosen half shows, and the fallback. */
function firstToolIn(
  zone: ToolZone,
  slot: ToolSlot,
  surface: ToolSurface,
  state: ToolState,
): ToolId | null {
  const first = toolsInZone(zone, surface).find(
    candidate => candidate.slot === slot && canOffer(candidate.id, surface, state),
  )
  return first ? first.id : null
}

/**
 * Every panel this section can currently open, across all zones. What the native menu is told,
 * since it lives in the main process and cannot ask a store.
 */
export function availableToolIds(surface: ToolSurface): ToolId[] {
  const state = toolStateOf(surface)
  return TOOLS.filter(tool => serves(tool, surface) && canOffer(tool.id, surface, state)).map(
    tool => tool.id,
  )
}

/**
 * The tools of a zone this section can actually offer. Generating without a model is impossible,
 * so the generator is not merely disabled there — it is absent, and the rail shows what the
 * section can do rather than what it cannot.
 *
 * The state is passed in rather than read: `useAvailableTools` subscribes to it, and `canOffer`
 * stays module-private, which is what it was before the hook moved out.
 */
export function toolsAvailableIn(zone: ToolZone, surface: ToolSurface, state: ToolState): Tool[] {
  return toolsInZone(zone, surface).filter(tool => canOffer(tool.id, surface, state))
}
