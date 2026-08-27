import type { Asset } from '@shared/domain/asset'
import type { FileOutcome, PathChange } from '@shared/domain/fileOp'
import { moveAssetFile, moveAssetFileToFree } from '@main/assets/assetFile'
import type { AsyncCatalog } from './catalogClient'
import { appendMove, clearJournal } from './fileJournal'
import {
  changeOf,
  folderSnapshot,
  foldersFor,
  planFiles,
  type FileAct,
  type FileRequest,
  type FolderSnapshot,
} from './filePlan'
import { inverseBatch, steppedStacks, UNDO_DEPTH, type UndoStacks } from './fileStacks'
import type { FolderReader, FolderWriter } from './folder'

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
  /**
   * Told what actually moved, so what the studio references BY PATH can follow. Only `game.json`
   * does — a script is an ordinary `.ts` file, and every other reference carries an identifier.
   */
  pathsChanged?: (changes: readonly PathChange[]) => void
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
  pathsChanged,
}: FileOpsDeps): FileOps {
  /**
   * The batches this project can take back, oldest first, and the ones taken back.
   *
   * **Not `engines/core/history.ts`, and the two do not merge.** Compared line by line, what they
   * share is `[...a, x].slice(-N)` and `a.slice(0, -1)`; what they do not share is everything
   * that makes either of them work. A `Command` transforms an in-memory STATE and hands the new
   * one back (`[S, History<S>]`) — here the state is the disk, and no value stands for it. A
   * command is reverted by replaying its declared inverse; a batch is reverted by replaying what
   * it ACTUALLY did, asynchronously, and what goes on the other pile is what actually came back
   * — possibly nothing, a case that cannot arise where reverting is a pure function. And its
   * coalescing, its `forget` and its `dropped` all serve a document's clean mark, which files
   * have no equivalent of.
   *
   * Extracting the intersection would publish an alias for two array expressions, in a module
   * `shared/` would have to hold for a renderer and a worker to both reach it.
   */
  let stacks: UndoStacks = { past: [], future: [] }
  let stackedFor: string | null = null

  /**
   * A stack belongs to ONE project: paths mean nothing outside the folder they were read in.
   *
   * Asked on every entry point rather than on the writes alone — including `can()`, which greys
   * the two menu rows. Opening another project and pressing ⌘Z straight away would otherwise
   * replay the previous project's batch against the new folder: most of it finds nothing and
   * does nothing, and the one path both projects happen to share moves for no reason.
   */
  const keepStackFor = (root: string | null): void => {
    if (stackedFor === root) return
    stackedFor = root
    stacks = { past: [], future: [] }
  }

  const snapshot = (folders: readonly string[]): Promise<FolderSnapshot> =>
    folderSnapshot(one => folder.names(one), folders)

  /** One act on the disk. Answers whether it happened; the writer refuses rather than throwing. */
  const write = async (act: FileAct): Promise<boolean> => {
    switch (act.act) {
      case 'move':
        return await folder.move(act.from, act.to)
      case 'copy':
        return await folder.copy(act.from, act.to)
      case 'createFolder':
        return await folder.createFolder(act.to)
      case 'trash':
        return await folder.trash(act.from)
    }
  }

  /**
   * Carries the acts out one after another, and answers what actually happened.
   *
   * **Sequential, and the reason is `revert` rather than the forward pass.** A plan settles its
   * own names before it is handed here — `planFiles` counts what a member of the same batch has
   * claimed — so the acts of one PLAN never collide. The inverses of a batch do: undoing "x.txt
   * moved out, then another x.txt moved in" is two acts fighting over one name, and only the
   * order they run in decides it. One loop rather than one loop and a parallel twin, so the
   * gesture and its undo cannot behave differently.
   *
   * A batch can also hold a folder and something inside it, which nothing refuses: run at once,
   * the two renames would race over a path one of them is moving.
   */
  const apply = async (root: string, acts: readonly FileAct[]): Promise<PathChange[]> => {
    const done: PathChange[] = []

    for (const act of acts) {
      const written = await write(act)
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
   *
   * What went is DATED rather than dropped, which is the trash being reversible taken seriously:
   * a file the user takes back out is found where the catalogue still says it is, and the next
   * pass clears the date. The row never stopped holding the prompt in between.
   */
  const follow = async (root: string, done: readonly PathChange[]): Promise<void> => {
    let forgotten = 0

    for (const { from, to } of done) {
      if (from && to) await catalog().repath(from, to)
      else if (from) forgotten += await catalog().forgetUnder(from)
    }

    if (done.some(({ from, to }) => from && to)) await clearJournal(root)
    if (forgotten > 0) assetsChanged()
    // Last, and after the catalogue: what references a file BY PATH — `game.json` alone — has
    // to be told, and it is told about what actually happened rather than about what was asked.
    if (done.length > 0) pathsChanged?.(done)
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
      stacks = { ...stacks, future: [] }
    } else if (done.length > 0) {
      stacks = { past: [...stacks.past, done].slice(-UNDO_DEPTH), future: [] }
    }

    return { done, refused: plan.refused, batch }
  }

  /** Replays a batch backwards, which is the same `apply` over the acts `inverseBatch` orders. */
  const replay = async (batch: readonly PathChange[]): Promise<PathChange[]> => {
    const root = rootOf()
    if (!root) return []

    const done = await apply(root, inverseBatch(batch))
    await follow(root, done)
    return done
  }

  const shift = async (way: 'undo' | 'redo'): Promise<FileOutcome> => {
    keepStackFor(rootOf())

    const stepped = await steppedStacks(stacks, way, replay)
    stacks = stepped.stacks

    return { done: [...stepped.done], refused: [], batch: newBatchId() }
  }

  return {
    rename: (path, name) => run({ op: 'rename', path, name }),
    move: (paths, folder: string) => run({ op: 'move', paths, folder }),
    duplicate: (paths, folder = null) => run({ op: 'duplicate', paths, folder }),
    createFolder: (folder: string, name) => run({ op: 'createFolder', folder, name }),
    trash: paths => run({ op: 'trash', paths }),

    undo: () => shift('undo'),
    redo: () => shift('redo'),

    can: () => {
      keepStackFor(rootOf())
      return { undo: stacks.past.length > 0, redo: stacks.future.length > 0 }
    },

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
