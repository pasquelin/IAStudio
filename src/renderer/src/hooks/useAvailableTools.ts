import { useMemo } from 'react'
import type { ToolSurface, ToolZone } from '@shared/domain/tool'
import { toolsAvailableIn, type Tool } from '@/helpers/toolRegistry'
import { useToolState } from './useToolState'

/** `toolsAvailableIn` for a rail that has to redraw when a model is picked or a project opened. */
export function useAvailableTools(zone: ToolZone, surface: ToolSurface): Tool[] {
  const state = useToolState()

  return useMemo(() => toolsAvailableIn(zone, surface, state), [zone, surface, state])
}
