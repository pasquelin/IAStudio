/**
 * Tool registry, shared by both processes. It lives in `shared/` because `{ id, zone }` is
 * domain data, not UI: the native menu needs it to restore a removed tool, and the renderer
 * enriches it with icons and components. Duplicating it in the main process would degrade
 * `ToolId` to `string` and force a cast back on the other side.
 */
export type ToolZone = 'left' | 'right' | 'top' | 'bottom'

export type ToolId = 'explorer' | 'models' | 'generator' | 'assets' | 'jobs'

export type ToolPlacement = {
  id: ToolId
  zone: ToolZone
}

export const TOOL_PLACEMENTS: readonly ToolPlacement[] = [
  { id: 'explorer', zone: 'left' },
  { id: 'models', zone: 'right' },
  { id: 'generator', zone: 'right' },
  { id: 'assets', zone: 'bottom' },
  { id: 'jobs', zone: 'bottom' },
]

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
