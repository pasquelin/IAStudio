import type { FileHistory, FileOutcome, PathChange } from '@shared/domain/fileOp'
import {
  changeOf,
  folderSnapshot,
  foldersFor,
  planFiles,
  type FileAct,
  type FileRequest,
  type FolderSnapshot,
} from '@main/project/filePlan'
import { inverseBatch, steppedStacks, UNDO_DEPTH, type UndoStacks } from '@main/project/fileStacks'
import type { MemoryCatalog } from './memoryCatalog'
import type { MemoryFolder } from './memoryFolder'

/**
 * 🛑 It DECIDES nothing: what may be renamed, moved, copied or thrown away is `planFiles`' answer,
 * and what one step of the stacks MEANS is `steppedStacks`'. What is written here is the writing
 * itself — the only half where the state is a Map rather than a disk.
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
  /**
   * Empties what the DECOR did, so it is not read as what the model did — and nothing else.
   *
   * 🛑 The stack of what is left to REDO survives: a decor that undoes on purpose is laying out
   * a studio with something to redo, and emptying it made « refais l'opération que je viens
   * d'annuler » unwinnable by any model, measured 2026-08-31.
   */
  forget: () => void
}

const EMPTY: FileOutcome = { done: [], refused: [], batch: 'batch-none' }

export function createMemoryFiles(folder: MemoryFolder, catalog: MemoryCatalog): MemoryFiles {
  let batches = 0
  let stacks: UndoStacks = { past: [], future: [] }

  /** The port's own state, read the way `fileOps` reads a disk. */
  const snapshot = (request: FileRequest): Promise<FolderSnapshot> =>
    folderSnapshot(one => folder.names(one), foldersFor(request))

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
    if (done.length > 0) stacks = { past: [...stacks.past, done].slice(-UNDO_DEPTH), future: [] }

    return { done, refused, batch: `batch-${(batches += 1)}` }
  }

  const step = async (way: 'undo' | 'redo'): Promise<FileOutcome> => {
    const stepped = await steppedStacks(stacks, way, batch => answer(inverseBatch(batch)))
    if (stepped.stacks === stacks) return EMPTY

    stacks = stepped.stacks
    return { done: [...stepped.done], refused: [], batch: `batch-${(batches += 1)}` }
  }

  return {
    rename: (path, name) => plan({ op: 'rename', path, name }),
    move: (paths, folder: string) => plan({ op: 'move', paths, folder }),
    duplicate: (paths, folder = null) => plan({ op: 'duplicate', paths, folder }),
    createFolder: (parent, name) => plan({ op: 'createFolder', folder: parent, name }),
    trash: paths => plan({ op: 'trash', paths }),
    undo: () => step('undo'),
    redo: () => step('redo'),
    can: () => ({ undo: stacks.past.length > 0, redo: stacks.future.length > 0 }),
    forget: () => {
      stacks = { past: [], future: stacks.future }
    },
  }
}
