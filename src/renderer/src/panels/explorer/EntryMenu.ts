import {
  mdiContentCopy,
  mdiContentCut,
  mdiContentDuplicate,
  mdiContentPaste,
  mdiFolderOpenOutline,
  mdiFolderPlusOutline,
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
import type { FileHistory } from '@shared/domain/file-op'
import { isStudioFolder, isStudioOwned } from '@shared/domain/folder'
import { acceleratorOf } from '@shared/domain/shortcut'
import { showContextMenu, type ContextMenuRow } from '@/helpers/context-menu'
import { getBridge } from '@/services/bridge'
import type { FolderNode } from './use-folder-tree'

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
  run: (command: CommandId) => void
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
  run,
}: EntryMenuProps): void {
  /**
   * Whether this row has a channel that can rename it — a question about WHAT it is, not about
   * where it sits.
   *
   * A document has its own channel, an asset has the catalogue's, and both move the file with
   * the name. What has neither is greyed, and this is why the catalogue is asked before the menu
   * is drawn: a picture the user dropped into `assets/img` themselves is no row of ours, and
   * `renameFile` refuses it under `isStudioOwned` while no other channel claims it.
   */
  const renamable = document !== null || asset !== null || !isStudioOwned(node.path)

  /** What the studio still holds for itself, until the reconciliation pass lets it go. */
  const owned = selection.some(isStudioOwned)

  /**
   * A row that runs a command, showing the key that command answers to.
   *
   * The words are handed in already translated rather than derived from the command id: a menu
   * row and a shortcut list are read in different places and say different things — « Coller »
   * beside a name, a sentence about the clipboard in a settings list. Composing the key from the
   * id would also put both of them out of reach of `known-keys.i18n.test.ts`.
   */
  const row = (
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
      disabled: clipboard === 0 || isStudioOwned(folder),
    }),
    { separator: true },
    row('explorer.newFolder', {
      label: t('explorer.newFolder'),
      tooltip: t('explorer.newFolderHint'),
      icon: mdiFolderPlusOutline,
      disabled: isStudioOwned(folder),
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
      // go of the rows underneath with it — which is what tells this apart from `owned` above.
      disabled: selection.some(isStudioFolder),
    }),
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
  ])
}
