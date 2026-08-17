import {
  mdiCloudOutline,
  mdiCreationOutline,
  mdiCubeScan,
  mdiFileTreeOutline,
  mdiFolderMultipleOutline,
  mdiFolderOutline,
  mdiGridLarge,
  mdiHistory,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiPaletteSwatchOutline,
  mdiSourceBranch,
  mdiTuneVariant,
  mdiVideoVintage,
  mdiWeatherPartlyCloudy,
  mdiEyeOutline,
} from '@mdi/js'
import { useMemo } from 'react'
import {
  HOME_SURFACE,
  placementIn,
  serves,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolSlot,
  type ToolSurface,
  type ToolZone,
} from '@shared/domain/tool'
import { modelForFamily, useModelForFamily } from '@/helpers/modelForFamily'
import { NODE_KINDS } from '@/engines/scene/nodeKinds'
import { useProject } from '@/stores/project'
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
  skybox: mdiWeatherPartlyCloudy,
  view: mdiEyeOutline,
  assets: mdiImageMultipleOutline,
  channels: mdiGridLarge,
  styles: mdiPaletteSwatchOutline,
  // The home's own. `mdiFolderOutline` is the Explorer's and `mdiCreationOutline` the
  // generator's: a rail where two glyphs mean two things is a rail one reads twice.
  projects: mdiFolderMultipleOutline,
  library: mdiCloudOutline,
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
  { left: [], right: [], top: [], bottom: [] },
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

/**
 * The two answers the shared registry cannot give — they depend on state, and `shared/` holds
 * no runtime dependency. Hence a layer here, above the registry rather than in it.
 */
export function toolStateOf(surface: ToolSurface): ToolState {
  const family = familyOfSurface(surface)
  return {
    hasModel: Boolean(family && modelForFamily(family)),
    hasProject: useProject.getState().project !== null,
  }
}

/**
 * What a surface can offer beyond what the registry declares — the two rules that depend on
 * state, and so cannot live in `shared/`.
 */
export type ToolState = {
  /** A model to generate with: one chosen in the Models panel, or one preferred in the settings. */
  hasModel: boolean
  /** A project folder open, which is what the Explorer reads. */
  hasProject: boolean
}

/**
 * Whether a section can offer this panel at all.
 *
 * Two panels answer to more than the registry. Generating without a model is impossible, so the
 * generator is absent rather than disabled. And the Explorer stands on the HOME only while a
 * project is open — every space keeps it whatever happens, because a space is already a project
 * being edited, but on the entry point it would say « no project open » beside the very shelf
 * that opens one.
 */
function canOffer(id: ToolId, surface: ToolSurface, state: ToolState): boolean {
  if (id === 'generator') return state.hasModel
  if (id === 'explorer' && surface === HOME_SURFACE) return state.hasProject
  // Every surface, unlike the Explorer above: what is versioned is a project folder, and there
  // is nothing to say about one that is not open. In a space it is always true.
  if (id === 'git' || id === 'history') return state.hasProject
  return true
}

/**
 * The same two answers, subscribed rather than read once: the rail has to redraw the moment a
 * model is picked or a project opened, and a plain read would leave the icon out until
 * something else happened to re-render.
 */
export function useToolState(surface: ToolSurface): ToolState {
  const hasModel = Boolean(useModelForFamily(familyOfSurface(surface)))
  const hasProject = useProject(state => state.project !== null)

  return useMemo(() => ({ hasModel, hasProject }), [hasModel, hasProject])
}

/**
 * What a half of a zone actually draws, given what it holds — `undefined` for a closed half,
 * `null` for one open on no panel in particular, an id for a panel the user chose.
 *
 * Three substitutions are settled here rather than in the store, which knows what is open per
 * zone and nothing about sections.
 *
 * A half nobody has chosen for shows the first panel this section declares there. That first
 * panel differs in each — the layers in Image, the shelf in Video, the sky in Skyboxes — which
 * is exactly why the store holds no id for it.
 *
 * A half holding a tool this section puts elsewhere — or does not have at all — shows what the
 * section does put there. What the user opened is a zone, and it stays that zone: the bottom
 * band is the shelf in Image and the montage in Video, without either of them being reopened
 * by hand on every switch. Closing the half still empties it everywhere, which is the one
 * thing the click actually said.
 *
 * And a generator without a model gives way to the Models panel. All three leave the persisted
 * state alone, so a section that has what was asked for restores it.
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
 * The tools of a zone this section can actually offer. Generating without a model is
 * impossible, so the generator is not merely disabled there — it is absent, and the rail shows
 * what the section can do rather than what it cannot.
 */
export function useAvailableTools(zone: ToolZone, surface: ToolSurface): Tool[] {
  const state = useToolState(surface)

  return useMemo(
    () => toolsInZone(zone, surface).filter(tool => canOffer(tool.id, surface, state)),
    [zone, surface, state],
  )
}
