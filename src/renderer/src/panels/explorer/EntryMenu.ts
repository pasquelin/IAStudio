import { mdiFolderOpenOutline, mdiRenameOutline, mdiTrashCanOutline } from '@mdi/js'
import { isStudioFolder } from '@shared/domain/folder'
import { showContextMenu } from '@/helpers/context-menu'
import { getBridge } from '@/services/bridge'
import type { FolderNode } from './use-folder-tree'

export type EntryMenuProps = {
  node: FolderNode
  /** True while a tab is showing this file, which is what forbids renaming it. */
  openInTab: boolean
  /** Already translated: the system's menu draws what it is handed and looks nothing up. */
  labels: { reveal: string; rename: string; trash: string }
  /** What each row does, for the tooltip macOS shows on hover. */
  hints: { reveal: string; rename: string; trash: string }
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
export function openEntryMenu({ node, openInTab, labels, hints, onRename }: EntryMenuProps): void {
  // The catalogue stores every asset by a path under `assets/`, so moving one of the studio's
  // own folders orphans rows nobody can find again. The main process refuses it too — this is
  // what says so before the click rather than after it.
  const ownFolder = isStudioFolder(node.path)

  void showContextMenu([
    {
      label: labels.reveal,
      icon: mdiFolderOpenOutline,
      tooltip: hints.reveal,
      onSelect: () => void getBridge()?.project.revealFile(node.path),
    },
    {
      label: labels.rename,
      icon: mdiRenameOutline,
      tooltip: hints.rename,
      // A document's file name IS its identifier. Renaming a closed one gives it a new id and
      // costs nothing; renaming one a tab is holding orphans that tab, and the next save would
      // write the old name back beside the new file.
      disabled: ownFolder || openInTab,
      onSelect: onRename,
    },
    {
      label: labels.trash,
      icon: mdiTrashCanOutline,
      tooltip: hints.trash,
      disabled: ownFolder,
      onSelect: () => void getBridge()?.project.trashFile(node.path),
    },
  ])
}
