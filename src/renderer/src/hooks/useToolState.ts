import { useMemo } from 'react'
import { gitHoldsFolder } from '@shared/domain/git'
import type { ToolState } from '@/helpers/toolRegistry'
import { useGit } from '@/stores/git'
import { useProject } from '@/stores/project'

/**
 * What `toolStateOf` reads once, subscribed instead: a plain read would leave the icon out until
 * something else happened to re-render, and a `git init` has to redraw the rail.
 */
export function useToolState(): ToolState {
  const hasProject = useProject(state => state.project !== null)
  const hasGit = useGit(state => gitHoldsFolder(state.repository))

  return useMemo(() => ({ hasProject, hasGit }), [hasProject, hasGit])
}
