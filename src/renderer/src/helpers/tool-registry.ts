import {
  mdiCreationOutline,
  mdiCubeScan,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiProgressClock,
  mdiTuneVariant,
  mdiVideoVintage,
  mdiWeatherPartlyCloudy,
} from '@mdi/js'
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

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
  slot: ToolSlot
  workspaces?: readonly WorkspaceId[]
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
  jobs: mdiProgressClock,
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
