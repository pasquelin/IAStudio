import { useMemo } from 'react'
import type { ToolSurface } from '@shared/domain/tool'
import { familyOfSurface } from '@/helpers/workspaces'
import type { ToolState } from '@/helpers/toolRegistry'
import { useProject } from '@/stores/project'
import { useModelForFamily } from './useModelForFamily'

/**
 * The same two answers `toolStateOf` reads once, subscribed rather than read: the rail has to
 * redraw the moment a model is picked or a project opened, and a plain read would leave the icon
 * out until something else happened to re-render.
 */
export function useToolState(surface: ToolSurface): ToolState {
  const hasModel = Boolean(useModelForFamily(familyOfSurface(surface)))
  const hasProject = useProject(state => state.project !== null)

  return useMemo(() => ({ hasModel, hasProject }), [hasModel, hasProject])
}
