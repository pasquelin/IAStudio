import type { GitRepository, GitStatus } from '@shared/domain/git'
import { useGit } from './git'

/** A branch with one version behind it and nothing waiting to be recorded. */
export const gitStatus = (status: Partial<GitStatus> = {}): GitStatus => ({
  branch: 'main',
  head: 'a3f9c1e',
  upstream: null,
  ahead: 0,
  behind: 0,
  files: [],
  ...status,
})

/** A folder git answers about, which is the one state where the studio reads versions. */
export const gitReadyRepository = (status: Partial<GitStatus> = {}): GitRepository => ({
  kind: 'ready',
  status: gitStatus(status),
})

/** The same, written into the store — what a rail or a shell needs, neither of them reading git. */
export function trackByGit(status: Partial<GitStatus> = {}): void {
  useGit.setState({ repository: gitReadyRepository(status) })
}
