import type { FileHistory, FileOutcome, PathChange } from '@shared/domain/fileOp'
import {
  changeOf,
  foldersFor,
  inverseOf,
  planFiles,
  type FileAct,
  type FileRequest,
  type FolderSnapshot,
} from '@main/project/filePlan'
import type { MemoryCatalog } from './memoryCatalog'
import type { MemoryFolder } from './memoryFolder'

/**
 * 🛑 It DECIDES nothing: what may be renamed, moved, copied or thrown away is `planFiles`' answer.
 * What is written here is the order of the writes and the stack of batches — `fileOps`' job,
 * which cannot be shared because there the state is a disk and here it is a Map.
 */
export type MemoryFiles = {
  rename: (path: string, name: string) => Promise<FileOutcome>
  move: (paths: readonly string[], folder: string) => Promise<FileOutcome>
  duplicate: (paths: readonly string[], folder?: string | null) => Promise<FileOutcome>
  createFolder: (folder: string, name: string) => Promise<FileOutcome>
  trash: (paths: readonly string[]) => Promise<FileOutcome>
  undo: () => Promise<FileOutcome>
  redo: () => Promise<FileOutcome>
  can: () => FileHistory
  /** Empties both stacks, so what the DECOR did is not read as what the model did. */
  forget: () => void
}

const EMPTY: FileOutcome = { done: [], refused: [], batch: 'batch-none' }

export function createMemoryFiles(folder: MemoryFolder, catalog: MemoryCatalog): MemoryFiles {
  let batches = 0
  let past: PathChange[][] = []
  let future: PathChange[][] = []

  /**
   * What the planner reads the project as, asked the way `fileOps` asks it: only the folders the
   * request names, and only those the disk answers for — a folder missing from the map is one
   * that does not exist, which is how `planFiles` refuses a destination that has gone.
   */
  const snapshot = async (request: FileRequest): Promise<FolderSnapshot> => {
    const unique = [...new Set(foldersFor(request))]
    const read = await Promise.all(unique.map(one => folder.names(one)))

    const known = new Map<string, readonly string[]>()
    for (const [at, names] of read.entries()) {
      const path = unique[at]
      if (path !== undefined && names !== null) known.set(path, names)
    }
    return known
  }

  const carry = async (act: FileAct): Promise<void> => {
    if (act.act === 'createFolder') await folder.createFolder(act.to)
    else if (act.act === 'trash') {
      await folder.trash(act.from)
      await catalog.forgetUnder(act.from)
    } else if (act.act === 'copy') await folder.copy(act.from, act.to)
    else {
      await folder.move(act.from, act.to)
      await catalog.repath(act.from, act.to)
    }
  }

  const answer = async (acts: readonly FileAct[]): Promise<PathChange[]> => {
    const done: PathChange[] = []
    for (const act of acts) {
      await carry(act)
      done.push(changeOf(act))
    }

    return done
  }

  const plan = async (request: FileRequest): Promise<FileOutcome> => {
    const { acts, refused } = planFiles(request, await snapshot(request))
    const done = await answer(acts)
    if (done.length > 0) {
      past = [...past, done]
      future = []
    }

    return { done, refused, batch: `batch-${(batches += 1)}` }
  }

  const step = async (from: 'past' | 'future'): Promise<FileOutcome> => {
    const stack = from === 'past' ? past : future
    const taken = stack.at(-1)
    if (!taken) return EMPTY

    if (from === 'past') past = past.slice(0, -1)
    else future = future.slice(0, -1)

    // The trash has no inverse — see `inverseOf`, which is why undo stops there.
    const back = taken.map(inverseOf).filter((one): one is FileAct => one !== null)
    const done = await answer(back)
    if (from === 'past') future = [...future, done]
    else past = [...past, done]

    return { done, refused: [], batch: `batch-${(batches += 1)}` }
  }

  return {
    rename: (path, name) => plan({ op: 'rename', path, name }),
    move: (paths, folder: string) => plan({ op: 'move', paths, folder }),
    duplicate: (paths, folder = null) => plan({ op: 'duplicate', paths, folder }),
    createFolder: (parent, name) => plan({ op: 'createFolder', folder: parent, name }),
    trash: paths => plan({ op: 'trash', paths }),
    undo: () => step('past'),
    redo: () => step('future'),
    can: () => ({ undo: past.length > 0, redo: future.length > 0 }),
    forget: () => {
      past = []
      future = []
    },
  }
}
