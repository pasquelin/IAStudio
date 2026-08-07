import {
  mdiCreationOutline,
  mdiCubeScan,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiTuneVariant,
  mdiVideoVintage,
  mdiWeatherPartlyCloudy,
} from '@mdi/js'
import { useMemo } from 'react'
import {
  placementIn,
  servesWorkspace,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolSlot,
  type ToolZone,
} from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'
import { NODE_KINDS } from '@/engines/scene/node-kinds'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { workspaceById } from './workspaces'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
  slot: ToolSlot
  workspaces: readonly WorkspaceId[]
}

const ICONS: Record<ToolId, string> = {
  layers: mdiLayersOutline,
  // From the scene registry: the rail icon and the panel's own empty state must not drift.
  meshes: NODE_KINDS.mesh.icon,
  lights: NODE_KINDS.light.icon,
  timeline: mdiVideoVintage,
  explorer: mdiFolderOutline,
  models: mdiCubeScan,
  generator: mdiCreationOutline,
  inspector: mdiTuneVariant,
  skybox: mdiWeatherPartlyCloudy,
  assets: mdiImageMultipleOutline,
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
 * The tools of a zone that the workspace actually has. A layer stack means nothing in the audio
 * space: its icon has no business sitting in that rail, and its panel none being restored there
 * by a layout arranged elsewhere.
 */
export function toolsInZone(zone: ToolZone, workspace: WorkspaceId): Tool[] {
  return BY_ZONE[zone].filter(tool => servesWorkspace(tool, workspace))
}

export function toolServes(id: ToolId, workspace: WorkspaceId): boolean {
  return placementIn(id, workspace) !== null
}

/** The zone a tool occupies here — the shelf does not live in the same one everywhere. */
export function toolZoneIn(id: ToolId, workspace: WorkspaceId): ToolZone | null {
  return placementIn(id, workspace)?.zone ?? null
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

/**
 * Whether this section has a model to generate with — one chosen in the Models panel, or one
 * preferred in the settings, which is what that preference is for.
 *
 * This is the single placement rule the shared registry cannot answer: it depends on state, and
 * `shared/` holds no runtime dependency. Hence a layer here, above the registry rather than in
 * it.
 */
export function hasModelFor(workspace: WorkspaceId): boolean {
  const { family } = workspaceById(workspace)
  const { selected } = useModels.getState()
  const { defaultModels } = useSettings.getState().settings.generation
  return Boolean(selected[family] ?? defaultModels[family])
}

/**
 * Same question, subscribed rather than read once: the rail has to redraw the moment a model is
 * picked, and `hasModelFor` alone would leave the generator's icon out until something else
 * happened to re-render.
 */
export function useHasModel(workspace: WorkspaceId): boolean {
  const { family } = workspaceById(workspace)
  const chosen = useModels(state => state.selected[family])
  const preferred = useSettings(state => state.settings.generation.defaultModels[family])
  return Boolean(chosen ?? preferred)
}

/**
 * The tools of a zone this section can actually offer. Generating without a model is
 * impossible, so the generator is not merely disabled there — it is absent, and the rail shows
 * what the section can do rather than what it cannot.
 */
export function useAvailableTools(zone: ToolZone, workspace: WorkspaceId): Tool[] {
  const hasModel = useHasModel(workspace)

  return useMemo(
    () => toolsInZone(zone, workspace).filter(tool => tool.id !== 'generator' || hasModel),
    [zone, workspace, hasModel],
  )
}
