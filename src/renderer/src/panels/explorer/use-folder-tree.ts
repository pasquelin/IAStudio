import { useCallback, useEffect, useRef, useState } from 'react'
import { FOLDER_ROOT, isUnder, parentOf, type FolderEntry } from '@shared/domain/folder'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'

/** One entry of the project folder, in the shape `Tree` walks. */
export type FolderNode = FolderEntry & { id: string; parentId: string | null }

/** What one folder answered. Kept together so the absorb step knows what it may replace. */
type Listing = { folder: string; entries: readonly FolderEntry[] }

export type FolderTree = {
  nodes: readonly FolderNode[]
  /** The folders that are open, which is also what says a chevron is worth drawing. */
  expandedIds: ReadonlySet<string>
  toggle: (path: string) => void
  /** Reads the root and every open folder again — what a disk event and a refocus both ask for. */
  reload: () => void
}

const nodeOf = (entry: FolderEntry): FolderNode => ({
  ...entry,
  id: entry.path,
  parentId: parentOf(entry.path),
})

/**
 * Reads folders. Answers what they hold and touches no state — which is what lets the effects
 * below own their `setState` rather than hiding one inside a call.
 *
 * A folder that will not answer contributes nothing rather than failing the whole pass: it is
 * often the event itself that says the folder went, and the parent's own listing is what takes
 * its row off the tree.
 */
async function listing(folders: readonly string[]): Promise<Listing[]> {
  const bridge = getBridge()
  if (!bridge) return []

  return await Promise.all(
    folders.map(folder =>
      bridge.project
        .listFolder(folder)
        .then(entries => ({ folder, entries }))
        .catch(() => ({ folder, entries: [] })),
    ),
  )
}

/**
 * The project folder as a tree, read one level at a time.
 *
 * A folder is read when it is opened and never before: `assets/img` holds thousands of files in
 * an ordinary project, and a reader who never opens it must not pay for them — which is also
 * why a folder that has never been opened cannot say whether it has children, and why the tree
 * is told which nodes are expandable rather than deriving it.
 */
export function useFolderTree(): FolderTree {
  const projectPath = useProject(state => state.project?.path ?? null)
  const [nodes, setNodes] = useState<readonly FolderNode[]>([])
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set())

  // Read at call time so `reload` never depends on it: the set changes on every toggle, and a
  // reload rebuilt on each one would restart the reads it is in the middle of.
  const open = useRef<ReadonlySet<string>>(new Set())
  useEffect(() => {
    open.current = expandedIds
  }, [expandedIds])

  const absorb = useCallback((answers: readonly Listing[]) => {
    setNodes(current => {
      // Everything UNDER a folder that was read again goes, so a file deleted on disk leaves
      // the tree with it. Strictly under: a folder's own row belongs to its parent's listing,
      // and counting it as its own child emptied the tree the moment one was opened.
      const kept = current.filter(node => !answers.some(({ folder }) => isUnder(node.id, folder)))
      return [...kept, ...answers.flatMap(({ entries }) => entries.map(nodeOf))]
    })
  }, [])

  // Emptied during the render that changes project, not after it — the pattern `useShelf`
  // already carries. Every path in the tree named the folder just left, and a tree kept a frame
  // longer is a tree whose rows are clickable and lead nowhere.
  const [source, setSource] = useState(projectPath)
  if (source !== projectPath) {
    setSource(projectPath)
    setNodes([])
    setExpandedIds(new Set())
  }

  useEffect(() => {
    if (projectPath) void listing([FOLDER_ROOT]).then(absorb)
  }, [projectPath, absorb])

  const reload = useCallback(() => {
    if (projectPath) void listing([FOLDER_ROOT, ...open.current]).then(absorb)
  }, [projectPath, absorb])

  // The disk, and the window coming back to the front. The second is not a duplicate of the
  // first: a recursive watch is not offered everywhere, and a project on a network volume can
  // emit nothing at all — a read on refocus costs one listing per open folder and covers it.
  useEffect(() => {
    const stop = getBridge()?.project.onFolderChanged(reload)
    window.addEventListener('focus', reload)
    return () => {
      stop?.()
      window.removeEventListener('focus', reload)
    }
  }, [reload])

  const toggle = useCallback(
    (path: string) => {
      setExpandedIds(current => {
        const next = new Set(current)
        if (next.delete(path)) return next

        next.add(path)
        // Read on the way open, every time rather than once: a folder opened again after an
        // hour would otherwise show what it held the first time.
        void listing([path]).then(absorb)
        return next
      })
    },
    [absorb],
  )

  return { nodes, expandedIds, toggle, reload }
}
