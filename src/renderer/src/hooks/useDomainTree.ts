import { useMemo } from 'react'
import { useFolded } from '@/hooks/useFolded'
import { domainNodes, type ExplorerNode } from '@/panels/explorer/domainNodes'
import { entriesSorted } from '@/panels/explorer/folderSort'
import { useProjectItems } from './useProjectItems'
import type { FolderTree } from './useFolderTree'

export type DomainTree = Omit<FolderTree, 'nodes'> & {
  nodes: readonly ExplorerNode[]
  /** Whether the folder has been walked — what tells an empty project from one still reading. */
  loaded: boolean
}

/**
 * The project read by what its files ARE, in the shape the tree draws.
 *
 * `active` is what keeps a reading nobody asked for from walking the whole folder: the panel
 * holds all three sources at once so that leaving one restores the others untouched, and only
 * the one on screen may pay for itself.
 */
export function useDomainTree(
  hidden: boolean,
  active: boolean,
  sort: string | null,
  language: string,
): DomainTree {
  const { items, loaded, reload } = useProjectItems(hidden, active)
  /** The headings folded shut by hand. Every other one is open — see `domainNodes`. */
  const folded = useFolded()

  const built = useMemo(() => domainNodes(items), [items])

  const nodes = useMemo(
    () => [...built.headings, ...entriesSorted(built.files, sort, language)],
    [built, sort, language],
  )

  const expandedIds = useMemo(() => {
    const open = new Set(built.expandedIds)
    for (const id of folded.ids) open.delete(id)
    return open
  }, [built.expandedIds, folded.ids])

  return { nodes, expandedIds, toggle: folded.toggle, reload, loaded }
}
