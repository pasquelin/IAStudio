import { useCallback, useMemo, useState } from 'react'
import { domainNodes, isDomainHeading, type ExplorerNode } from './domain-nodes'
import { entriesSorted } from './folder-sort'
import { useProjectItems } from './use-project-items'
import type { FolderTree } from './use-folder-tree'

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
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  const built = useMemo(() => domainNodes(items, language), [items, language])

  const nodes = useMemo(() => {
    const headings = built.nodes.filter(isDomainHeading)
    const files = built.nodes.flatMap(node => (isDomainHeading(node) ? [] : [node]))
    // Only the files are ordered: the headings come in the order the studio names its domains
    // everywhere else, which is not something a sort of file names has anything to say about.
    return [...headings, ...entriesSorted(files, sort, language)]
  }, [built.nodes, sort, language])

  const expandedIds = useMemo(() => {
    const open = new Set(built.expandedIds)
    for (const id of collapsed) open.delete(id)
    return open
  }, [built.expandedIds, collapsed])

  const toggle = useCallback((id: string) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  return { nodes, expandedIds, toggle, reload, loaded }
}
