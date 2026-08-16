import { mdiFolderOpenOutline, mdiRenameOutline, mdiTrashCanOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { isStudioFolder, isStudioOwned } from '@shared/domain/folder'
import { showContextMenu } from '@/helpers/context-menu'
import { getBridge } from '@/services/bridge'
import type { FolderNode } from './use-folder-tree'

export type EntryMenuProps = {
  node: FolderNode
  /** The document this row is, when it is one — which is what may be renamed under `documents/`. */
  document: DocumentDescriptor | null
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
export function openEntryMenu({ node, document, t, onRename }: EntryMenuProps): void {
  // The catalogue stores every asset by a path under `assets/`, so moving one of the studio's
  // own folders orphans rows nobody can find again. The main process refuses it too — this is
  // what says so before the click rather than after it.
  const ownFolder = isStudioFolder(node.path)

  /**
   * Everything under those folders, which is what the main process now refuses — a document is
   * renamed through its own channel and an asset in the catalogue, so renaming either as a
   * plain file leaves the studio pointing at a path that is gone.
   *
   * A document is the exception, and the whole point: it has its own gesture, and this menu
   * hands it over. Anything else in there is greyed rather than opening a field that closes on
   * a refusal nothing reports.
   */
  const ownedFile = isStudioOwned(node.path) && !document

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
      disabled: ownFolder || ownedFile,
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
