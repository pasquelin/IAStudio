import {
  mdiContentCopy,
  mdiContentCut,
  mdiContentDuplicate,
  mdiContentPaste,
  mdiFileImportOutline,
  mdiFolderOpenOutline,
  mdiFolderPlusOutline,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiRedo,
  mdiRenameOutline,
  mdiTrashCanOutline,
  mdiUndo,
} from '@mdi/js'
import type { TFunction } from 'i18next'
import type { Asset } from '@shared/domain/asset'
import { bindingOf, type BindingOverrides, type CommandId } from '@shared/domain/command'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { FileHistory } from '@shared/domain/fileOp'
import { isPrivatePath } from '@shared/domain/folder'
import { acceleratorOf } from '@shared/domain/shortcut'
import { showContextMenu, type ContextMenuRow } from '@/helpers/contextMenu'
import type { FolderNode } from '@/hooks/useFolderTree'
import { getBridge } from '@/services/bridge'
import type { AssetAction } from './assetActions'
import { assetMenuGroups } from './assetMenu'

export type EntryMenuProps = {
  node: FolderNode
  /** Every row the gesture applies to. The clicked one is in it — `Tree` arms the menu first. */
  selection: readonly string[]
  /** The document this row is, when it is one — which is what may be renamed under `documents/`. */
  document: DocumentDescriptor | null
  /**
   * The asset this row is, when the catalogue holds one at its path.
   *
   * A folder walk cannot tell: the tree has paths, and whether one of them is an asset is a
   * question only the catalogue answers. Handed in already answered rather than asked here — a
   * menu is drawn on a click and cannot wait on a round trip.
   */
  asset: Asset | null
  /** Where a new folder, or a paste, would land: the row itself if it is a folder, else its own. */
  folder: string
  /** How many paths the clipboard is holding, so Coller greys itself when it holds none. */
  clipboard: number
  history: FileHistory
  /** What the user remapped, so each row shows the key actually in force — never a written one. */
  bindings: BindingOverrides
  /** The window's translator, as every menu of this studio takes it — see `openAssetMenu`. */
  t: TFunction
  onOpen: () => void
  onRename: () => void
  /**
   * The three gestures that act on the catalogue rows behind the selection, rather than on the
   * files themselves. They live here since the shelf stopped listing what the project holds:
   * naming pictures, laying them out on a sheet and sending them up are all about assets, and
   * this panel is where the assets of a project are now looked at.
   */
  onAsset: (action: AssetAction) => void
  run: (command: CommandId) => void
}

/**
 * A row that runs a command, showing the key that command answers to.
 *
 * The words are handed in already translated rather than derived from the command id: a menu row
 * and a shortcut list are read in different places and say different things — « Coller » beside a
 * name, a sentence about the clipboard in a settings list. Composing the key from the id would
 * also put both of them out of reach of `known-keys.i18n.test.ts`.
 *
 * Shared by the two menus of this panel, so a gesture reached from a row and the same gesture
 * reached from the blank show the same key and run the same command.
 */
function commandRows(bindings: BindingOverrides, run: (command: CommandId) => void) {
  return (
    id: CommandId,
    words: { label: string; tooltip: string; icon: string; disabled: boolean },
  ): ContextMenuRow => {
    const accelerator = acceleratorOf(bindingOf(id, bindings))
    return {
      ...words,
      onSelect: () => run(id),
      // Left out where a command answers to no key, rather than sent as an empty string.
      ...(accelerator ? { accelerator } : {}),
    }
  }
}

/**
 * The two rows both menus end on, rule included. The file stack belongs to the PANEL rather than
 * to a row, so the blank and a row take a batch back the same way and show the same key.
 */
function historyRows(
  row: ReturnType<typeof commandRows>,
  t: TFunction,
  history: FileHistory,
): ContextMenuRow[] {
  return [
    { separator: true },
    row('explorer.undo', {
      label: t('explorer.undo'),
      tooltip: t('explorer.undoHint'),
      icon: mdiUndo,
      disabled: !history.undo,
    }),
    row('explorer.redo', {
      label: t('explorer.redo'),
      tooltip: t('explorer.redoHint'),
      icon: mdiRedo,
      disabled: !history.redo,
    }),
  ]
}

export type RootMenuProps = {
  /** How many paths the clipboard is holding, so Coller greys itself when it holds none. */
  clipboard: number
  history: FileHistory
  bindings: BindingOverrides
  t: TFunction
  /**
   * Brings files in from the disk. Aimed at the PROJECT rather than at a row, which is why it
   * hangs off the blank: it moved here when the shelf stopped listing what the project holds,
   * and the shelf's own title row was the only place offering it.
   */
  onImport: () => void
  /** Runs the command against the PROJECT FOLDER, whatever the selection was a moment ago. */
  run: (command: CommandId) => void
}

/**
 * What can be done with the project folder itself, from the blank below the rows.
 *
 * Four gestures, and every one of them is one of the twelve below — same command, same key, same
 * words. The other eight are missing rather than greyed because they are about a FILE: the
 * project folder is not opened, renamed, duplicated or thrown away, and the blank is the only
 * place in this panel that aims at it.
 *
 * It exists because `assets/` and `documents/` were the studio's own until the reconciliation
 * pass let them go: a project whose every row is a folder could aim at the root by clicking the
 * blank, but nothing there raised a menu — so a brand new project offered no way at all to make
 * a folder in it.
 */
export function openRootMenu({
  clipboard,
  history,
  bindings,
  t,
  onImport,
  run,
}: RootMenuProps): void {
  const row = commandRows(bindings, run)

  void showContextMenu([
    {
      label: t('assets.import'),
      tooltip: t('assets.importHint'),
      icon: mdiFileImportOutline,
      onSelect: onImport,
    },
    { separator: true },
    row('explorer.paste', {
      label: t('explorer.paste'),
      tooltip: t('explorer.pasteHint'),
      icon: mdiContentPaste,
      disabled: clipboard === 0,
    }),
    { separator: true },
    row('explorer.newFolder', {
      label: t('explorer.newFolder'),
      tooltip: t('explorer.newFolderHint'),
      icon: mdiFolderPlusOutline,
      disabled: false,
    }),
    ...historyRows(row, t, history),
  ])
}

/**
 * What can be done with the project folder, from one of its rows.
 *
 * Twelve gestures in four groups, and every one of them also answers to a key — the rows show
 * which, read from the binding actually in force rather than written out, so a remapped command
 * moves here too. Drawn but never reserved: see `ContextMenuItem`.
 *
 * Greyed rather than dropped, the rule this studio's menus already follow: a menu that changes
 * length depending on what is selected is a menu one cannot learn.
 *
 * **Nothing is deleted** — `trashItem` puts the file where the user can get it back. It is their
 * folder, and erasing something in it is a gesture the studio does not take.
 */
export function openEntryMenu({
  node,
  selection,
  document,
  asset,
  folder,
  clipboard,
  history,
  bindings,
  t,
  onOpen,
  onRename,
  onAsset,
  run,
}: EntryMenuProps): void {
  /**
   * Whether this row has a channel that can rename it — a question about WHAT it is, not about
   * where it sits.
   *
   * A document has its own channel, an asset has the catalogue's, and both move the file with
   * the name; a plain file has `renameFile`. Only the machine's own bookkeeping has none of the
   * three, which is what the last term answers — and the catalogue is still asked before the
   * menu is drawn, because WHICH channel carries the gesture is what its answer decides.
   */
  const renamable = document !== null || asset !== null || !isPrivatePath(node.path)

  /**
   * What the studio holds for itself — the machine's bookkeeping, and nothing else since the
   * reconciliation pass let `assets/` and `documents/` go.
   *
   * Read from the same predicate the main process reads, which is what the dot toggle made
   * necessary: the menu once offered every gesture on `.project.json`, each one refused
   * afterwards. The panel greys out exactly what the disk will refuse, or it is promising
   * something it cannot do.
   */
  const owned = selection.some(path => isPrivatePath(path))

  // The count the three catalogue gestures name — a folder has no row behind it, and neither has
  // anything the studio keeps for itself.
  const files = selection.filter(path => !isPrivatePath(path)).length

  const row = commandRows(bindings, run)

  void showContextMenu([
    {
      label: t('explorer.openEntry'),
      icon: mdiOpenInNew,
      tooltip: t('explorer.openEntryHint'),
      onSelect: onOpen,
    },
    {
      label: t('explorer.reveal'),
      icon: mdiFolderOpenOutline,
      tooltip: t('explorer.revealHint'),
      onSelect: () => void getBridge()?.project.revealFile(node.path),
    },
    {
      label: t('explorer.fileInfo'),
      icon: mdiInformationOutline,
      tooltip: t('explorer.fileInfoHint'),
      // Greyed on a folder rather than dropped, as every row of this menu is: what the window
      // answers — type, dimensions, fingerprint, the catalogue row — is a FILE's, and a folder
      // would reach it with three quarters of the screens missing.
      disabled: node.kind !== 'file',
      // The CLICKED row, never the selection: the window is about one entry, and a right-click
      // on a file inside a selection of twelve names that file.
      onSelect: () => void getBridge()?.fileInfo.open(node.path),
    },
    { separator: true },
    row('explorer.cut', {
      label: t('explorer.cut'),
      tooltip: t('explorer.cutHint'),
      icon: mdiContentCut,
      disabled: owned,
    }),
    row('explorer.copy', {
      label: t('explorer.copy'),
      tooltip: t('explorer.copyHint'),
      icon: mdiContentCopy,
      disabled: owned,
    }),
    row('explorer.paste', {
      label: t('explorer.paste'),
      tooltip: t('explorer.pasteHint'),
      icon: mdiContentPaste,
      disabled: clipboard === 0 || isPrivatePath(folder),
    }),
    { separator: true },
    row('explorer.newFolder', {
      label: t('explorer.newFolder'),
      tooltip: t('explorer.newFolderHint'),
      icon: mdiFolderPlusOutline,
      disabled: isPrivatePath(folder),
    }),
    row('explorer.duplicate', {
      label: t('explorer.duplicate'),
      tooltip: t('explorer.duplicateHint'),
      icon: mdiContentDuplicate,
      disabled: owned,
    }),
    {
      label: t('explorer.rename'),
      icon: mdiRenameOutline,
      tooltip: t('explorer.renameHint'),
      // No longer refused while a tab holds it. A document's file name WAS its identifier, so
      // renaming an open one orphaned its tab and the next save wrote the old name back beside
      // the new file; the id now lives in the envelope and stays put.
      disabled: !renamable,
      onSelect: onRename,
    },
    row('explorer.trash', {
      label: t('explorer.trash'),
      tooltip: t('explorer.trashHint'),
      icon: mdiTrashCanOutline,
      // A folder of the studio's own layout stays; what it HOLDS may go, and the catalogue lets
      // go of the rows underneath with it — which is what `shown` says, and what tells this
      // apart from `owned` above. Nothing under a dot goes either way.
      disabled: selection.some(path => isPrivatePath(path, 'shown')),
    }),
    /*
     * Greyed on a selection holding no file at all, and no finer than that: which of the files
     * the catalogue actually holds is a round trip, and a menu is drawn on a click. The gesture
     * asks once it has been chosen and drops what has no row — see `runAssetAction`.
     */
    ...assetMenuGroups({ asset, count: files, t, onAsset }),
    ...historyRows(row, t, history),
  ])
}
