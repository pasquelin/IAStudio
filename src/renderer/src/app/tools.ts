import {
  mdiCreationOutline,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiProgressClock,
} from '@mdi/js'
import { TOOL_PLACEMENTS, type ToolId, type ToolZone } from '@shared/domain/tool'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
}

const ICONS: Record<ToolId, string> = {
  explorer: mdiFolderOutline,
  generator: mdiCreationOutline,
  assets: mdiImageMultipleOutline,
  jobs: mdiProgressClock,
}

/**
 * Tool windows, IDE-style: they live on the edges, one per zone at a time, and are picked
 * from the icon rail. Only the center carries tabs — those are documents, and a document has
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

export function toolsInZone(zone: ToolZone): Tool[] {
  return BY_ZONE[zone]
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

export { isHorizontal, isLeading } from '@shared/domain/tool'
export type { ToolId, ToolZone } from '@shared/domain/tool'
