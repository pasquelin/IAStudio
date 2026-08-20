import type { GitRepository } from '@shared/domain/git'
import { useGit } from '@/stores/git'
import { useGitWatch } from './useGitWatch'

/** The repository, kept honest by `useGitWatch` — for a panel that DRAWS it and must redraw. */
export function useGitStatus(): GitRepository {
  useGitWatch()

  return useGit(state => state.repository)
}
