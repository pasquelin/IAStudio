import {
  mdiCreationOutline,
  mdiCubeScan,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiLayersOutline,
  mdiProgressClock,
} from '@mdi/js'
import {
  placementOf,
  servesWorkspace,
  TOOL_PLACEMENTS,
  type ToolId,
  type ToolSlot,
  type ToolZone,
} from '@shared/domain/tool'
import type { WorkspaceId } from '@shared/domain/workspace'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
  slot: ToolSlot
  workspaces?: readonly WorkspaceId[]
}

const ICONS: Record<ToolId, string> = {
  layers: mdiLayersOutline,
  explorer: mdiFolderOutline,
  models: mdiCubeScan,
  generator: mdiCreationOutline,
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
  const placement = placementOf(id)
  return placement !== null && servesWorkspace(placement, workspace)
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

export { isHorizontal, isLeading, servesWorkspace, TOOL_SLOTS } from '@shared/domain/tool'
export type { ToolId, ToolSlot, ToolZone } from '@shared/domain/tool'
