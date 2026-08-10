import { mdiFolderOpenOutline, mdiRenameOutline, mdiTrashCanOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { isStudioFolder } from '@shared/domain/folder'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { getBridge } from '@/services/bridge'
import type { FolderNode } from './use-folder-tree'

export type EntryMenuProps = {
  node: FolderNode
  at: { x: number; y: number }
  /** True while a tab is showing this file, which is what forbids renaming it. */
  openInTab: boolean
  onRename: () => void
  onClose: () => void
}

/**
 * What can be done with one entry of the project folder.
 *
 * Three rows, and two of them refuse in cases the panel can name. Shown disabled rather than
 * hidden, the rule this studio's menus already follow: a menu that changes length depending on
 * what is selected is a menu one cannot learn.
 *
 * **Nothing is deleted** — `trashItem` puts the file where the user can get it back. It is their
 * folder, and erasing something in it is a gesture the studio does not take.
 */
export function EntryMenu({ node, at, openInTab, onRename, onClose }: EntryMenuProps) {
  const { t } = useTranslation()

  // The catalogue stores every asset by a path under `assets/`, so moving one of the studio's
  // own folders orphans rows nobody can find again. The main process refuses it too — this is
  // what says so before the click rather than after it.
  const ownFolder = isStudioFolder(node.path)

  const choose =
    (run: () => void): (() => void) =>
    () => {
      run()
      onClose()
    }

  return (
    <ContextMenu at={at} onClose={onClose}>
      <MenuRow
        label={t('explorer.reveal')}
        icon={mdiFolderOpenOutline}
        onSelect={choose(() => void getBridge()?.project.revealFile(node.path))}
      />
      <MenuRow
        label={t('explorer.rename')}
        icon={mdiRenameOutline}
        // A document's file name IS its identifier. Renaming a closed one gives it a new id and
        // costs nothing; renaming one a tab is holding orphans that tab, and the next save would
        // write the old name back beside the new file.
        disabled={ownFolder || openInTab}
        onSelect={choose(onRename)}
      />
      <MenuRow
        label={t('explorer.trash')}
        icon={mdiTrashCanOutline}
        disabled={ownFolder}
        onSelect={choose(() => void getBridge()?.project.trashFile(node.path))}
      />
    </ContextMenu>
  )
}
