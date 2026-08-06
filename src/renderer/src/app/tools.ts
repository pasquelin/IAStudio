import {
  mdiCreationOutline,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiProgressClock,
} from '@mdi/js'

export type ToolZone = 'left' | 'right' | 'top' | 'bottom'

export type ToolId = 'explorer' | 'generator' | 'assets' | 'jobs'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
}

/**
 * Tool windows, IDE-style: they live on the edges, one per zone at a time, and are picked
 * from the icon rail. Only the center carries tabs — those are documents, and a document has
 * a name; a tool has an icon.
 */
export const TOOLS: readonly Tool[] = [
  { id: 'explorer', icon: mdiFolderOutline, zone: 'left' },
  { id: 'generator', icon: mdiCreationOutline, zone: 'right' },
  { id: 'assets', icon: mdiImageMultipleOutline, zone: 'bottom' },
  { id: 'jobs', icon: mdiProgressClock, zone: 'bottom' },
]

export const ZONES: readonly ToolZone[] = ['left', 'right', 'top', 'bottom']

export function toolsInZone(zone: ToolZone): Tool[] {
  return TOOLS.filter(tool => tool.zone === zone)
}

/** i18n key of a tool's title — never the displayed text. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

/** Horizontal zones: their size is set as a height, not a width. */
export function isHorizontal(zone: ToolZone): boolean {
  return zone === 'top' || zone === 'bottom'
}

export function isToolZone(value: string): value is ToolZone {
  return ZONES.some(zone => zone === value)
}

export function isToolId(value: string): value is ToolId {
  return TOOLS.some(tool => tool.id === value)
}
