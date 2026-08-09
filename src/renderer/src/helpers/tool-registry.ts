import {
  mdiApplicationBracesOutline,
  mdiCreationOutline,
  mdiCubeScan,
  mdiFileTreeOutline,
  mdiFolderOutline,
  mdiGridLarge,
  mdiImageMultipleOutline,
  mdiLayersOutline,
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
import type { ModelFamily } from '@shared/domain/model'
import { NODE_KINDS } from '@/engines/scene/node-kinds'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { workspaceById } from './workspaces'

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
  scene: mdiFileTreeOutline,
  models: mdiCubeScan,
  generator: mdiCreationOutline,
  inspector: mdiTuneVariant,
  skybox: mdiWeatherPartlyCloudy,
  view: mdiEyeOutline,
  assets: mdiImageMultipleOutline,
  channels: mdiGridLarge,
  apps: mdiApplicationBracesOutline,
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

/** What a surface generates into. The home generates nothing: it opens documents, it makes none. */
function familyOf(surface: ToolSurface): ModelFamily | null {
  return surface === HOME_SURFACE ? null : workspaceById(surface).family
}

/**
 * Whether this surface has a model to generate with — one chosen in the Models panel, or one
 * preferred in the settings, which is what that preference is for.
 *
 * This is the single placement rule the shared registry cannot answer: it depends on state, and
 * `shared/` holds no runtime dependency. Hence a layer here, above the registry rather than in
 * it.
 */
export function hasModelFor(surface: ToolSurface): boolean {
  const family = familyOf(surface)
  if (!family) return false

  const { selected } = useModels.getState()
  const { defaultModels } = useSettings.getState().settings.generation
  return Boolean(selected[family] ?? defaultModels[family])
}

/**
 * Whether a section can offer this panel at all. The generator is the only one whose presence
 * depends on state rather than on the registry: generating without a model is impossible, so
 * it is absent rather than disabled.
 */
function canOffer(id: ToolId, hasModel: boolean): boolean {
  return id !== 'generator' || hasModel
}

/**
 * Same question, subscribed rather than read once: the rail has to redraw the moment a model is
 * picked, and `hasModelFor` alone would leave the generator's icon out until something else
 * happened to re-render.
 */
export function useHasModel(surface: ToolSurface): boolean {
  const family = familyOf(surface)
  const chosen = useModels(state => (family ? state.selected[family] : undefined))
  const preferred = useSettings(state =>
    family ? state.settings.generation.defaultModels[family] : undefined,
  )
  return Boolean(chosen ?? preferred)
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
  hasModel: boolean,
): ToolId | null {
  if (tool === undefined) return null
  if (tool === null) return firstToolIn(zone, slot, surface, hasModel)

  // Zone AND half: a stored id that names neither is not this half's business, whether it
  // belongs to the other column, the other half, or to a band no placement ever cuts.
  const placement = placementIn(tool, surface)
  if (placement?.zone === zone && placement.slot === slot) {
    return canOffer(tool, hasModel) ? tool : 'models'
  }

  return firstToolIn(zone, slot, surface, hasModel)
}

/** The panel a section puts first in a half — what an unchosen half shows, and the fallback. */
function firstToolIn(
  zone: ToolZone,
  slot: ToolSlot,
  surface: ToolSurface,
  hasModel: boolean,
): ToolId | null {
  const first = toolsInZone(zone, surface).find(
    candidate => candidate.slot === slot && canOffer(candidate.id, hasModel),
  )
  return first ? first.id : null
}

/**
 * Every panel this section can currently open, across all zones. What the native menu is told,
 * since it lives in the main process and cannot ask a store.
 */
export function availableToolIds(surface: ToolSurface): ToolId[] {
  const hasModel = hasModelFor(surface)
  return TOOLS.filter(tool => serves(tool, surface) && canOffer(tool.id, hasModel)).map(
    tool => tool.id,
  )
}

/**
 * The tools of a zone this section can actually offer. Generating without a model is
 * impossible, so the generator is not merely disabled there — it is absent, and the rail shows
 * what the section can do rather than what it cannot.
 */
export function useAvailableTools(zone: ToolZone, surface: ToolSurface): Tool[] {
  const hasModel = useHasModel(surface)

  return useMemo(
    () => toolsInZone(zone, surface).filter(tool => canOffer(tool.id, hasModel)),
    [zone, surface, hasModel],
  )
}
