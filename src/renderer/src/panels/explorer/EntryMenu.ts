import { mdiFolderOpenOutline, mdiRenameOutline, mdiTrashCanOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { isStudioFolder, isStudioOwned } from '@shared/domain/folder'
import { showContextMenu } from '@/helpers/context-menu'
import { getBridge } from '@/services/bridge'
import type { FolderNode } from './use-folder-tree'

export type EntryMenuProps = {
  node: FolderNode
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
  /** The window's translator, as every menu of this studio takes it — see `openAssetMenu`. */
  t: TFunction
  onRename: () => void
}

/**
 * What can be done with one entry of the project folder.
 *
 * Three rows, and two of them refuse in cases the panel can name. Shown greyed rather than
 * dropped, the rule this studio's menus already follow: a menu that changes length depending on
 * what is selected is a menu one cannot learn.
 *
 * **Nothing is deleted** — `trashItem` puts the file where the user can get it back. It is their
 * folder, and erasing something in it is a gesture the studio does not take.
 */
export function openEntryMenu({ node, document, asset, t, onRename }: EntryMenuProps): void {
  // The catalogue stores every asset by a path under `assets/`, so moving one of the studio's
  // own folders orphans rows nobody can find again. The main process refuses it too — this is
  // what says so before the click rather than after it.
  const ownFolder = isStudioFolder(node.path)

  /**
   * Whether this row has a channel that can rename it — which is a question about WHAT it is,
   * not about where it sits.
   *
   * Everything under `assets/` and `documents/` used to be greyed on the grounds that the main
   * process refuses to rename it as a plain file, which it still does. But that refusal was
   * never about the gesture: it is about which channel carries it. A document has its own, an
   * asset has the catalogue's, and both move the file with the name.
   *
   * What has neither is greyed, and this is why the catalogue is asked before the menu is drawn:
   * a picture the user dropped into `assets/img` themselves is no row of ours, so `renameFile`
   * refuses it and no other channel claims it. Offering the gesture there opened a field that
   * closed on a failure only the journal mentioned — worse than the honest grey it replaced.
   */
  const renamable = document !== null || asset !== null || !isStudioOwned(node.path)

  void showContextMenu([
    {
      label: t('explorer.reveal'),
      icon: mdiFolderOpenOutline,
      tooltip: t('explorer.revealHint'),
      onSelect: () => void getBridge()?.project.revealFile(node.path),
    },
    {
      label: t('explorer.rename'),
      icon: mdiRenameOutline,
      tooltip: t('explorer.renameHint'),
      // No longer refused while a tab holds it. A document's file name WAS its identifier, so
      // renaming an open one orphaned its tab and the next save wrote the old name back beside
      // the new file; the id now lives in the envelope and stays put, which is what the whole
      // of that change bought.
      disabled: ownFolder || !renamable,
      onSelect: onRename,
    },
    {
      label: t('explorer.trash'),
      icon: mdiTrashCanOutline,
      tooltip: t('explorer.trashHint'),
      disabled: ownFolder,
      onSelect: () => void getBridge()?.project.trashFile(node.path),
    },
  ])
}
