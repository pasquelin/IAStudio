import type { CommandId } from '@shared/domain/command'
import { touchesDocuments, type FileOutcome } from '@shared/domain/fileOp'
import { getBridge } from '@/services/bridge'
import type { CommandAnswer } from '@/services/commandBus'
import { useDocuments } from '@/stores/documents'
import { useFileClipboard } from '@/stores/fileClipboard'
import { selectedFilePaths, useSelection } from '@/stores/selection'

export type ExplorerCommandContext = {
  /** Where a paste or a new folder lands. */
  into: string
  /** The name a folder is born with, already translated. */
  folderName: string
  /** What a panel adds once the main process answers — the tree reading its folders again. */
  settle?: (outcome: FileOutcome) => void
}

/**
 * What every batch of files leaves behind, wherever it was asked for: the documents are listed
 * again when it touched one — the panel that lists them walks the disk, so it learns nothing
 * until it is told.
 */
export function settleFileOutcome(outcome: FileOutcome): void {
  if (touchesDocuments(outcome.done)) void useDocuments.getState().relist()
}

async function settled(outcome: Promise<FileOutcome>, settle?: (outcome: FileOutcome) => void) {
  const done = await outcome
  settleFileOutcome(done)
  settle?.(done)
}

/**
 * The eight commands of the project folder, reached the same way from the panel and from a
 * headless run. Every one acts on the SELECTION or on the clipboard, never on a row; the stack
 * takes neither, acting on what the main process remembers.
 */
export function runExplorerCommand(
  command: CommandId,
  { into, folderName, settle }: ExplorerCommandContext,
): CommandAnswer {
  const bridge = getBridge()?.project
  if (!bridge) return false

  const paths = selectedFilePaths(useSelection.getState())
  const held = useFileClipboard.getState()

  switch (command) {
    // Nothing crosses the boundary yet: what is held is a selection of the project folder, and
    // it means something only once a folder is named to put it in.
    case 'explorer.cut':
    case 'explorer.copy':
      if (paths.length === 0) return false
      held.hold(paths, command === 'explorer.cut')
      return true
    case 'explorer.paste':
      if (held.paths.length === 0) return false
      void settled(bridge.pasteFiles(held.paths, into, held.cut), settle)
      // A cut is spent by the paste that carried it out; a copy stays, so pasting into three
      // folders in a row is three copies rather than one and two silences.
      if (held.cut) held.clear()
      return true
    case 'explorer.newFolder':
      void settled(bridge.newFolder(into, folderName), settle)
      return true
    // 🛑 Both answer BLIND, where every other scope answers `false` on an empty stack: the file
    // stack lives in the main process and this answer is synchronous. `fileHistory` is what the
    // panel greys its two rows with, and nothing here can await it.
    case 'explorer.undo':
      void settled(bridge.undoFile(), settle)
      return true
    case 'explorer.redo':
      void settled(bridge.redoFile(), settle)
      return true
    case 'explorer.duplicate':
      if (paths.length === 0) return false
      void settled(bridge.duplicateFiles(paths), settle)
      return true
    case 'explorer.trash':
      if (paths.length === 0) return false
      void settled(bridge.trashFiles(paths), settle)
      return true
    default:
      return false
  }
}
