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
  duplicate: (paths: readonly string[], folder?: string | null) => Promise<FileOutcome>
  createFolder: (folder: string, name: string) => Promise<FileOutcome>
  trash: (paths: readonly string[]) => Promise<FileOutcome>
  undo: () => Promise<FileOutcome>
  redo: () => Promise<FileOutcome>
  can: () => {
    undo: boolean
    redo: boolean
  }
  renameAsset: (asset: Asset, name: string) => Promise<string | undefined>
  renameAssetToCaption: (asset: Asset, name: string) => Promise<void>
}
export type FileOpsDeps = {
  rootOf: () => string | null
  folder: FolderReader & FolderWriter
  catalog: () => AsyncCatalog
  newBatchId: () => string
  assetsChanged: () => void
  pathsChanged: (changes: readonly PathChange[]) => void
}
export function createFileOps({
  rootOf,
  folder,
  catalog,
  newBatchId,
  assetsChanged,
  pathsChanged,
}: FileOpsDeps): FileOps {
  let stacks: UndoStacks = { past: [], future: [] }
  let stackedFor: string | null = null
  const keepStackFor = (root: string | null): void => {
    if (stackedFor === root) return
    stackedFor = root
    stacks = { past: [], future: [] }
  }
  const snapshot = (folders: readonly string[]): Promise<FolderSnapshot> =>
    folderSnapshot(one => folder.names(one), folders)
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
  const apply = async (root: string, acts: readonly FileAct[]): Promise<PathChange[]> => {
    const done: PathChange[] = []
    for (const act of acts) {
      const written = await write(act)
      if (!written) continue
      const change = changeOf(act)
      if (change.from && change.to) await appendMove(root, change)
      done.push(change)
    }
    return done
  }
  const follow = async (root: string, done: readonly PathChange[]): Promise<void> => {
    let forgotten = 0
    for (const { from, to } of done) {
      if (from && to) await catalog().repath(from, to)
      else if (from) forgotten += await catalog().forgetUnder(from)
    }
    if (done.some(({ from, to }) => from && to)) await clearJournal(root)
    if (forgotten > 0) assetsChanged()
    if (done.length > 0) pathsChanged(done)
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
      stacks = { ...stacks, future: [] }
    } else if (done.length > 0) {
      stacks = { past: [...stacks.past, done].slice(-UNDO_DEPTH), future: [] }
    }
    return { done, refused: plan.refused, batch }
  }
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
    renameAsset: async (asset, name) => {
      const root = rootOf()
      return root ? await moveAssetFile(root, asset, name) : undefined
    },
    renameAssetToCaption: async (asset, name) => {
      const root = rootOf()
      if (!root) return
      const moved = await moveAssetFileToFree(root, asset, name)
      await catalog().add(moved ? { ...asset, ...moved } : { ...asset, name })
    },
  }
}
