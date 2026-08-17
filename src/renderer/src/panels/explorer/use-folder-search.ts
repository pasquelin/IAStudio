import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { entriesByName, nameOf, parentOf, type FolderEntry } from '@shared/domain/folder'
import { useDebounced } from '@/hooks/useDebounced'
import { useFolded } from '@/hooks/useFolded'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import type { FolderNode, FolderTree } from './use-folder-tree'

/** How long a hand keeps typing. Every keystroke otherwise walks the whole project folder. */
const SETTLE_MS = 200

/**
 * The same shape `useFolderTree` answers with, so the panel swaps one source for the other and
 * changes nothing else — plus what only a search can say: whether the walk has come back.
 */
export type FolderSearch = FolderTree & { answered: boolean }

type Found = { nodes: readonly FolderNode[]; answered: boolean }

const NOTHING: Found = { nodes: [], answered: false }

/**
 * Every folder on the way to a match, as a node of its own.
 *
 * `flattenTree` drops a node whose parent is missing rather than promoting it to a root, so a
 * match nine folders down would be thrown away with nothing on screen to say why. What comes
 * back from the main process is the matches alone — the chain is rebuilt here, from the path,
 * which already spells it.
 */
function withAncestors(entries: readonly FolderEntry[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>()

  const add = (entry: FolderEntry): void => {
    nodes.set(entry.path, { ...entry, id: entry.path, parentId: parentOf(entry.path) })
  }

  for (const entry of entries) {
    // Written last so a folder that is itself a match keeps the entry the disk reported rather
    // than the one an earlier match's chain invented.
    add(entry)
    for (let parent = parentOf(entry.path); parent !== null; parent = parentOf(parent)) {
      if (nodes.has(parent)) break
      add({ path: parent, name: nameOf(parent), kind: 'folder' })
    }
  }

  return [...nodes.values()]
}

/**
 * The project folder narrowed by a word — the explorer's SECOND source of nodes.
 *
 * Not a filter over the first: the tree loads one folder at a time, so a word matching a file
 * nobody has ever unfolded is a word it could not answer. The main process walks the folder and
 * answers a flat list; the chain of folders above each match is rebuilt here.
 *
 * An empty term answers nothing at all, which is what puts the lazy tree back on screen — no
 * contract of `use-folder-tree` moves for this.
 */
export function useFolderSearch(term: string, hidden: boolean): FolderSearch {
  const projectPath = useProject(state => state.project?.path ?? null)
  const { i18n } = useTranslation()
  const language = i18n.language
  const settled = useDebounced(term, SETTLE_MS)
  const [found, setFound] = useState<Found>(NOTHING)
  /** The chains are drawn open — a match hidden under a fold is a match nobody was answered. */
  const folded = useFolded()
  const [asked, setAsked] = useState({ term, projectPath })
  const [again, setAgain] = useState(0)

  // Emptied during the render that leaves the search or changes project, not after it: every
  // path in the list names the folder just left, and rows kept a frame longer are clickable.
  // A term that merely GREW keeps its rows: they are real files, and blanking the panel on
  // every keystroke is a panel that flickers instead of one that answers.
  if (asked.term !== term || asked.projectPath !== projectPath) {
    setAsked({ term, projectPath })
    folded.reset()
    if (term === '' || asked.projectPath !== projectPath) setFound(NOTHING)
  }

  useEffect(() => {
    if (settled === '' || !projectPath) return

    let live = true
    void getBridge()
      ?.project.searchFolder(settled, hidden)
      .then(entries => {
        if (!live) return
        setFound({ nodes: withAncestors(entries).sort(entriesByName(language)), answered: true })
      })

    return () => {
      live = false
    }
  }, [settled, hidden, projectPath, language, again])

  const expandedIds = useMemo(() => {
    const open = new Set<string>()
    for (const node of found.nodes) {
      if (node.parentId !== null && !folded.ids.has(node.parentId)) open.add(node.parentId)
    }
    return open
  }, [found.nodes, folded.ids])

  // What a batch of file gestures asks for: the matches were read before it, and a file that
  // moved is at a path this list still spells the old way.
  const reload = useCallback(() => setAgain(count => count + 1), [])

  return { ...found, expandedIds, toggle: folded.toggle, reload }
}
