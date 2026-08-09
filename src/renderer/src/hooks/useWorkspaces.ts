import { useMemo } from 'react'
import { workspacesIn, type Workspace } from '@/helpers/workspaces'
import { useSettings } from '@/stores/settings'

/**
 * The bar of spaces, in the user's own order. One hook for the two surfaces that draw it, so
 * the title bar and the home can never disagree about what comes first.
 */
export function useWorkspaces(): Workspace[] {
  const order = useSettings(state => state.settings.workspaces.order)
  return useMemo(() => workspacesIn(order), [order])
}
