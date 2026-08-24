import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FOLDER_ROOT, isUnder, parentOf, type FolderEntry } from '@shared/domain/folder'
import { byCodeUnit } from '@shared/text'
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

/**
 * The tree plus the one gesture only a live reading can offer.
 *
 * Kept OUT of `FolderTree`, which is the shape the Explorer swaps its three sources through —
 * a search and a domain listing have no folder to unfold, and requiring it of them would make
 * the shape mean less than it does.
 */
export type UnfoldableFolderTree = FolderTree & {
  /**
   * Opens a folder that may already be open, and reads it either way. What a surface showing a
   * chosen folder needs: `toggle` would close the very row it was asked to reveal.
   */
  unfold: (path: string) => void
}

const nodeOf = (entry: FolderEntry): FolderNode => ({
  ...entry,
  id: entry.path,
  parentId: parentOf(entry.path),
})

/**
 * The same rows in the same order — `id` and `parentId` both derive from the path, so what the
 * disk answers with is the whole comparison. `sameRows` in `useCatalogueAssets` is this shape
 * over the fields a catalogue row is judged by.
 */
const sameNodes = (held: readonly FolderNode[], found: readonly FolderNode[]): boolean =>
  held.length === found.length &&
  held.every(
    (node, index) =>
      node.path === found[index]?.path &&
      node.name === found[index]?.name &&
      node.kind === found[index]?.kind,
  )

/**
 * Reads folders. Answers what they hold and touches no state — which is what lets the effects
 * below own their `setState` rather than hiding one inside a call.
 *
 * A folder that will not answer contributes nothing rather than failing the whole pass: it is
 * often the event itself that says the folder went, and the parent's own listing is what takes
 * its row off the tree.
 */
async function listing(folders: readonly string[], hidden: boolean): Promise<Listing[]> {
  const bridge = getBridge()
  if (!bridge) return []

  return await Promise.all(
    folders.map(async folder => {
      try {
        return { folder, entries: await bridge.project.listFolder(folder, hidden) }
      } catch {
        // An empty listing rather than a hole: the note above says why a folder that went
        // missing mid-read is the ordinary case here, not a failure to report.
        return { folder, entries: [] }
      }
    }),
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
export function useFolderTree(hidden: boolean): UnfoldableFolderTree {
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
      const next = [...kept, ...answers.flatMap(({ entries }) => entries.map(nodeOf))]

      // Handed back UNCHANGED when the disk said the same thing, so React bails out rather than
      // re-rendering the panel: every focus on the window is a reading, `FOLDER_ROOT` makes each
      // one replace the whole tree, and the answer is the same one nearly every time.
      return sameNodes(current, next) ? current : next
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

  // Every open folder rather than the root alone once `hidden` moves: what a dot hides sits at
  // every level. Sorted, so the order says WHICH are open rather than when — `absorb` compares
  // position by position, and a fold then an unfold would miss the bail-out on an unchanged tree.
  const reload = useCallback(() => {
    if (!projectPath) return
    void listing([FOLDER_ROOT, ...Array.from(open.current).sort(byCodeUnit)], hidden).then(absorb)
  }, [projectPath, hidden, absorb])

  // The read at mount IS a reload, as `useCatalogueAssets` already spells it: the two had the
  // same body and the same dependencies, so a fix to one would have missed the other.
  useEffect(reload, [reload])

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

  // Read on the way open, every time rather than once: a folder opened again after an hour
  // would otherwise show what it held the first time.
  const opening = useCallback(
    (current: ReadonlySet<string>, path: string): ReadonlySet<string> => {
      void listing([path], hidden).then(absorb)
      return current.has(path) ? current : new Set(current).add(path)
    },
    [absorb, hidden],
  )

  const unfold = useCallback(
    (path: string) => setExpandedIds(current => opening(current, path)),
    [opening],
  )

  const toggle = useCallback(
    (path: string) => {
      setExpandedIds(current => {
        if (!current.has(path)) return opening(current, path)

        const next = new Set(current)
        next.delete(path)
        return next
      })
    },
    [opening],
  )

  // One identity for as long as nothing moves: the explorer swaps its three sources through a
  // `useMemo` that reads this object, and a fresh one every render re-sorts the whole tree.
  return useMemo(
    () => ({ nodes, expandedIds, toggle, unfold, reload }),
    [nodes, expandedIds, toggle, unfold, reload],
  )
}
