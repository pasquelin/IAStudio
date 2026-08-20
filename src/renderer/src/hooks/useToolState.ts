import { useMemo } from 'react'
import { gitHoldsFolder } from '@shared/domain/git'
import type { ToolSurface } from '@shared/domain/tool'
import { familyOfSurface } from '@/helpers/workspaces'
import type { ToolState } from '@/helpers/toolRegistry'
import { useGit } from '@/stores/git'
import { useProject } from '@/stores/project'
import { useModelForFamily } from './useModelForFamily'

/**
 * What `toolStateOf` reads once, subscribed instead: a plain read would leave the icon out until
 * something else happened to re-render, and a model picked or a `git init` has to redraw the rail.
 */
export function useToolState(surface: ToolSurface): ToolState {
  const hasModel = Boolean(useModelForFamily(familyOfSurface(surface)))
  const hasProject = useProject(state => state.project !== null)
  const hasGit = useGit(state => gitHoldsFolder(state.repository))

  return useMemo(() => ({ hasModel, hasProject, hasGit }), [hasModel, hasProject, hasGit])
}
