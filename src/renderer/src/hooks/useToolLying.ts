import { use } from 'react'
import { isHorizontal } from '@shared/domain/tool'
import { ToolZoneContext } from '@/app/toolZone'

/**
 * Whether the panel lies across the window rather than standing beside it. `false` outside a
 * tool window — a panel rendered in a test or a dialog is treated as a column, which is the
 * shape every panel was written for first.
 */
export function useToolLying(): boolean {
  const zone = use(ToolZoneContext)
  return zone !== null && isHorizontal(zone)
}
