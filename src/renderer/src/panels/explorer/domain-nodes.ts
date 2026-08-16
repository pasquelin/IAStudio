import { FILE_DOMAINS, type FileDomain } from '@shared/domain/file-role'
import { nameOf } from '@shared/domain/folder'
import type { ProjectItem } from '@/helpers/project-item'
import type { FolderNode } from './use-folder-tree'

/** One of the domains, standing as a root of the tree — a row that names rather than opens. */
export type DomainHeading = {
  id: string
  parentId: null
  domain: FileDomain
  /** How many files are filed under it. Drawn beside the name, and never zero: see below. */
  count: number
}

/** What the explorer's tree holds in either mode: a file of the project, or a domain naming some. */
export type ExplorerNode = FolderNode | DomainHeading

export const domainRowId = (domain: FileDomain): string => `domain:${domain}`

export function isDomainHeading(node: ExplorerNode): node is DomainHeading {
  return 'domain' in node
}

/**
 * The project read by what its files ARE — six domains and the one for everything else, each
 * holding the files filed under it.
 *
 * The domains come in the order `FILE_DOMAINS` declares, which is the order the shelf and the
 * rail already use; the files come by name, in the reader's own language. A domain nothing is
 * filed under is left out rather than drawn empty: the view answers what the project holds, and
 * seven headings over an empty project say nothing at all.
 *
 * The nodes are `FolderNode`s, `name` included, and that is deliberate: the rows are drawn by
 * the same reading the file tree uses — the document behind a file is found by its FILE name,
 * so an item named after its document's title would find nothing.
 */
export function domainNodes(
  items: readonly ProjectItem[],
  language: string,
): { nodes: ExplorerNode[]; expandedIds: Set<string> } {
  const nodes: ExplorerNode[] = []
  const children: FolderNode[] = []
  const expandedIds = new Set<string>()

  for (const domain of FILE_DOMAINS) {
    const filed = items.filter(item => item.domain === domain)
    if (filed.length === 0) continue

    const id = domainRowId(domain)
    nodes.push({ id, parentId: null, domain, count: filed.length })
    // Open by default: a browser that answers with seven closed folds has answered nothing.
    expandedIds.add(id)

    for (const item of [...filed].sort((one, other) =>
      nameOf(one.path).localeCompare(nameOf(other.path), language),
    )) {
      children.push({
        id: item.path,
        path: item.path,
        name: nameOf(item.path),
        kind: 'file',
        parentId: id,
      })
    }
  }

  return { nodes: [...nodes, ...children], expandedIds }
}
