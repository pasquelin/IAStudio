import { useMemo } from 'react'
import { gitHoldsFolder } from '@shared/domain/git'
import type { ToolState } from '@/helpers/toolRegistry'
import { accountsHoldLibrary, useAccounts } from '@/stores/accounts'
import { useDocuments } from '@/stores/documents'
import { useGit } from '@/stores/git'
import { useHomeVisible, useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'

/**
 * The stores `toolStateOf` reads. 🛑 Written ONCE, and consumed twice — by the hook below and by
 * anything driving the studio without a window: the two lists had already drifted, and a run
 * that missed `useGit` never offered the Git panel at all.
 */
type Subscribable = { subscribe: (listener: () => void) => () => void }

const SOURCES: Subscribable[] = [
  useProject,
  useGit,
  useAccounts,
  useDocuments,
  useLayouts,
  useSettings,
]

/**
 * Calls back whenever what a surface can offer may have changed. For a caller outside React —
 * the bench, a headless run — where `useToolState` cannot be used.
 */
export function subscribeToToolState(listener: () => void): () => void {
  const stops = SOURCES.map(store => store.subscribe(listener))
  return () => stops.forEach(stop => stop())
}

/**
 * What `toolStateOf` reads once, subscribed instead: a plain read would leave the icon out until
 * something else happened to re-render, and a `git init` has to redraw the rail.
 */
export function useToolState(): ToolState {
  const hasProject = useProject(state => state.project !== null)
  const hasGit = useGit(state => gitHoldsFolder(state.repository))
  const hasCloud = useAccounts(accountsHoldLibrary)
  const home = useHomeVisible()
  // Whether the centre holds ANY document, never how many: subscribed to the count, opening a
  // second tab would re-render every rail group and the shell around Dockview for nothing.
  const anyDocument = useDocuments(state => Object.keys(state.documents).length > 0)

  return useMemo(
    () => ({ hasProject, hasGit, hasCloud, centreTaken: home || anyDocument }),
    [hasProject, hasGit, hasCloud, home, anyDocument],
  )
}
