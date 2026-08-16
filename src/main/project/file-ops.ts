import type { Asset } from '@shared/domain/asset'
import type { FileOutcome, PathChange } from '@shared/domain/file-op'
import { moveAssetFile, moveAssetFileToFree } from '@main/assets/asset-file'
import type { AsyncCatalog } from './catalog-client'
import { appendMove, clearJournal } from './file-journal'
import {
  changeOf,
  foldersFor,
  inverseOf,
  planFiles,
  type FileAct,
  type FileRequest,
  type FolderSnapshot,
} from './file-plan'
import type { FolderReader, FolderWriter } from './folder'

/**
 * How many batches one project may take back. Bounded because the stack outlives every window
 * and holds only strings: thirty-two is far past what a hand undoes in one sitting, and the
 * whole of it costs less than one thumbnail.
 */
const UNDO_DEPTH = 32

export type FileOps = {
  rename: (path: string, name: string) => Promise<FileOutcome>
  move: (paths: readonly string[], folder: string) => Promise<FileOutcome>
  /** Copies. Into `folder`, or beside each source when there is none — see `FileRequest`. */
  duplicate: (paths: readonly string[], folder?: string | null) => Promise<FileOutcome>
  createFolder: (folder: string, name: string) => Promise<FileOutcome>
  trash: (paths: readonly string[]) => Promise<FileOutcome>
  /** Takes back the last batch, or answers an empty one when there is nothing to take back. */
  undo: () => Promise<FileOutcome>
  redo: () => Promise<FileOutcome>
  /** Whether either gesture would do anything — what a menu row reads to grey itself. */
  can: () => { undo: boolean; redo: boolean }
  /** An asset's file, moved to match its new name. Answers where it now is. */
  renameAsset: (asset: Asset, name: string) => Promise<string | undefined>
  /** The same, for a name the STUDIO wrote — a caption. Writes the row itself. */
  renameAssetToCaption: (asset: Asset, name: string) => Promise<void>
}

export type FileOpsDeps = {
  /** The open project, or nothing at all — every gesture answers empty without one. */
  rootOf: () => string | null
  folder: FolderReader & FolderWriter
  catalog: () => AsyncCatalog
  newBatchId: () => string
  /**
   * Told when the catalogue actually lost rows, so the shelves read themselves again.
   *
   * Injected rather than broadcast from here: only the trash can cost the catalogue a row in
   * this phase — an asset refuses to be moved at all — and telling every window to walk its
   * shelf over a `.pdf` of storyboard notes is a folder walk for nothing.
   */
  assetsChanged: () => void
}

/**
 * One orchestrator for every gesture that writes to the project folder.
 *
 * **The order is the whole of it, and it is always the same**: read the folders, plan against
 * that reading, write to the disk, journal what moved, tell the catalogue, then answer. Disk
 * first and catalogue second, never the reverse — the inverse order leaves a row pointing at a
 * path nothing is at, where this one leaves at worst a row naming where a file WAS, which is
 * exactly what the journal and the reconciliation pass exist to catch up on.
 *
 * It exists because the panel used to route a rename through three different channels depending
 * on what the row turned out to be, asking the catalogue before it could even draw the menu.
 * Six more gestures would have been that three-way branch written six more times, in the window.
 *
 * **Undo is not a second implementation.** A batch answers with the changes it actually made,
 * and putting them back is the same `apply` over their inverses — which is also why the trash
 * cannot be undone: a change with nothing at `to` has no inverse to build.
 */
export function createFileOps({
  rootOf,
  folder,
  catalog,
  newBatchId,
  assetsChanged,
}: FileOpsDeps): FileOps {
  /** The batches this project can take back, oldest first, and the ones taken back. */
  let undone: PathChange[][] = []
  let stack: PathChange[][] = []
  let stackedFor: string | null = null

  /** A stack belongs to ONE project: paths mean nothing outside the folder they were read in. */
  const keepStackFor = (root: string): void => {
    if (stackedFor === root) return
    stackedFor = root
    stack = []
    undone = []
  }

  const snapshot = async (folders: readonly string[]): Promise<FolderSnapshot> => {
    const unique = [...new Set(folders)]
    const read = await Promise.all(unique.map(one => folder.names(one)))

    const known = new Map<string, readonly string[]>()
    for (const [at, names] of read.entries()) {
      const path = unique[at]
      if (path !== undefined && names !== null) known.set(path, names)
    }
    return known
  }

  /**
   * Carries the acts out one after another, and answers what actually happened.
   *
   * Sequential on purpose. Two moves into the same folder settle a name between them, and a
   * `Promise.all` would let both see it free; the batch is bounded by what a hand selected, and
   * a folder walk costs more than the whole of this loop.
   */
  const apply = async (root: string, acts: readonly FileAct[]): Promise<PathChange[]> => {
    const done: PathChange[] = []

    for (const act of acts) {
      const written =
        act.act === 'move'
          ? await folder.move(act.from, act.to)
          : act.act === 'copy'
            ? await folder.copy(act.from, act.to)
            : act.act === 'createFolder'
              ? await folder.createFolder(act.to)
              : await folder.trash(act.from)

      if (!written) continue

      const change = changeOf(act)
      // Journalled after the write and before the catalogue, which is the only order that leans
      // safe — see `appendMove`. A creation and a trash carry nothing to repath and are skipped.
      if (change.from && change.to) await appendMove(root, change)
      done.push(change)
    }

    return done
  }

  /**
   * Puts the catalogue back in step with what the disk now says.
   *
   * `repath` for what moved, `forgetUnder` for what went — and nothing at all for what arrived,
   * because a copy is bytes nobody has catalogued yet. That is the reconciliation pass's to find,
   * and inventing a row here would be inventing an identity for it.
   */
  const follow = async (root: string, done: readonly PathChange[]): Promise<void> => {
    let forgotten = 0

    for (const { from, to } of done) {
      if (from && to) await catalog().repath(from, to)
      else if (from) forgotten += await catalog().forgetUnder(from)
    }

    if (done.some(({ from, to }) => from && to)) await clearJournal(root)
    if (forgotten > 0) assetsChanged()
  }

  const run = async (request: FileRequest): Promise<FileOutcome> => {
    const root = rootOf()
    const batch = newBatchId()
    if (!root) return { done: [], refused: [], batch }

    keepStackFor(root)

    const plan = planFiles(request, await snapshot(foldersFor(request)))
    const done = await apply(root, plan.acts)
    await follow(root, done)

    if (request.op === 'trash') {
      // The trash pushes nothing and CLEARS what was taken back: a ⌘Z after a deletion that put
      // an earlier move back would undo something nobody was thinking about.
      undone = []
    } else if (done.length > 0) {
      stack = [...stack, done].slice(-UNDO_DEPTH)
      undone = []
    }

    return { done, refused: plan.refused, batch }
  }

  /**
   * Replays a batch backwards, which is the same `apply` over inverted changes.
   *
   * Reversed as well as inverted: a batch that moved `a` out of the way and then `b` into its
   * place has to be taken back in the other order, or the second inverse lands on a name the
   * first has not freed yet.
   */
  const replay = async (batch: readonly PathChange[]): Promise<PathChange[]> => {
    const root = rootOf()
    if (!root) return []

    const acts = [...batch].reverse().flatMap(change => inverseOf(change) ?? [])
    const done = await apply(root, acts)
    await follow(root, done)
    return done
  }

  return {
    rename: (path, name) => run({ op: 'rename', path, name }),
    move: (paths, folder: string) => run({ op: 'move', paths, folder }),
    duplicate: (paths, folder = null) => run({ op: 'duplicate', paths, folder }),
    createFolder: (folder: string, name) => run({ op: 'createFolder', folder, name }),
    trash: paths => run({ op: 'trash', paths }),

    undo: async () => {
      const batch = stack.at(-1)
      const id = newBatchId()
      if (!batch) return { done: [], refused: [], batch: id }

      stack = stack.slice(0, -1)
      const done = await replay(batch)
      // What was PUT BACK is what a redo has to undo again, so the round trip stays exact even
      // where one member of the batch refused to come back.
      undone = [...undone, done].slice(-UNDO_DEPTH)
      return { done, refused: [], batch: id }
    },

    redo: async () => {
      const batch = undone.at(-1)
      const id = newBatchId()
      if (!batch) return { done: [], refused: [], batch: id }

      undone = undone.slice(0, -1)
      const done = await replay(batch)
      stack = [...stack, done].slice(-UNDO_DEPTH)
      return { done, refused: [], batch: id }
    },

    can: () => ({ undo: stack.length > 0, redo: undone.length > 0 }),

    /**
     * An asset's file follows its row's name. Nothing happens without a project open: the path
     * is relative to one, and there is no folder to move anything inside of.
     *
     * Here rather than in `services.ts` because this is the one place that writes to the project
     * folder — a rename reaching the disk through a second door is a rename the journal never
     * hears about.
     */
    renameAsset: async (asset, name) => {
      const root = rootOf()
      return root ? await moveAssetFile(root, asset, name) : undefined
    },

    /**
     * Renames an asset the STUDIO named itself — the captioner, and nothing else so far.
     *
     * Both halves, because they are one act: a row renamed on its own leaves the shelf reading
     * « une ruelle bleue » over a file still called `IMG_1234.png`, and this path never crosses
     * the rename channel that would have caught it.
     *
     * The name written is the one the FOLDER settled on, suffix and cleaning included. A caption
     * is a sentence a model wrote: there is nobody to hand a refusal back to, so it is made to
     * fit rather than rejected — and what the row says is then what the disk says.
     */
    renameAssetToCaption: async (asset, name) => {
      const root = rootOf()
      if (!root) return

      const moved = await moveAssetFileToFree(root, asset, name)
      // No file of ours to move — a linked rush, a row that lives in the library alone. Its name
      // is the catalogue's business only, so it takes the caption as it was written.
      await catalog().add(moved ? { ...asset, ...moved } : { ...asset, name })
    },
  }
}
