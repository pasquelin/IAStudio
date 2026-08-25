import { useMemo } from 'react'
import { scenarioAccount } from '@shared/domain/account'
import { gitHoldsFolder } from '@shared/domain/git'
import type { ToolState } from '@/helpers/toolRegistry'
import { useAccounts } from '@/stores/accounts'
import { useGit } from '@/stores/git'
import { useProject } from '@/stores/project'

/**
 * What `toolStateOf` reads once, subscribed instead: a plain read would leave the icon out until
 * something else happened to re-render, and a `git init` has to redraw the rail.
 */
export function useToolState(): ToolState {
  const hasProject = useProject(state => state.project !== null)
  const hasGit = useGit(state => gitHoldsFolder(state.repository))
  // A list not read yet counts as held — see `cloudIsHeld`, which this must answer alike or the
  // rail would disagree with the native menu about which panels exist.
  const hasCloud = useAccounts(
    state => !state.accountsLoaded || scenarioAccount(state.accounts) !== null,
  )

  return useMemo(() => ({ hasProject, hasGit, hasCloud }), [hasProject, hasGit, hasCloud])
}
