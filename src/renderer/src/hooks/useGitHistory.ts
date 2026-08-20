import { useEffect } from 'react'
import type { GitCommit } from '@shared/domain/git'
import { useGit } from '@/stores/git'
import { useGitStatus } from './useGitStatus'

/**
 * The history, re-read whenever the repository has moved under it.
 *
 * Keyed on the head and the branch rather than on a timer: those two are what a commit, an
 * amend or a checkout change, and they are the only three things that can add a version. The
 * status itself is kept honest by `useGitStatus`, which this leans on rather than repeating —
 * so mounting this hook keeps both panels current from one set of subscriptions.
 */
export function useGitHistory(): readonly GitCommit[] {
  const repository = useGitStatus()
  const commits = useGit(state => state.commits)
  const readHistory = useGit(state => state.readHistory)

  const head = repository.kind === 'ready' ? repository.status.head : null
  const branch = repository.kind === 'ready' ? repository.status.branch : null

  useEffect(() => {
    void readHistory(false)
  }, [readHistory, head, branch])

  return commits
}
