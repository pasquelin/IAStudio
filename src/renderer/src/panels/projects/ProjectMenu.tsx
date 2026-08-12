import { mdiFolderOpenOutline, mdiPlaylistRemove } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'

export type ProjectMenuProps = {
  path: string
  onClose: () => void
}

/**
 * What can be done to a recent project without opening it, as rows.
 *
 * Two, and neither touches the folder: one shows it in the system's file manager, the other drops
 * it from the shelf. **Nothing is deleted** — the studio does not erase a folder someone made,
 * and the shelf is a list of shortcuts. Reopening the project puts the row back, which is what
 * makes the second row safe to offer with no confirmation behind it.
 *
 * Rendered by two things — the right-click menu and the row's own button — because a right-click
 * is not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused cell, not the div
 * inside it that listens.
 */
export function ProjectMenuRows({ path, onClose }: ProjectMenuProps) {
  const { t } = useTranslation()

  const choose =
    (run: () => void): (() => void) =>
    () => {
      run()
      onClose()
    }

  return (
    <>
      <MenuRow
        label={t('home.projects.reveal')}
        icon={mdiFolderOpenOutline}
        tip={HINT_RIGHT(t('home.projects.revealHint'))}
        onSelect={choose(() => void getBridge()?.project.revealFolder(path))}
      />
      <MenuRow
        label={t('home.projects.forget')}
        icon={mdiPlaylistRemove}
        tip={HINT_RIGHT(t('home.projects.forgetHint'))}
        onSelect={choose(() => void useProject.getState().forget(path))}
      />
    </>
  )
}

/** The same rows, at the pointer. */
export function ProjectMenu({
  path,
  at,
  onClose,
}: ProjectMenuProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <ProjectMenuRows path={path} onClose={onClose} />
    </ContextMenu>
  )
}

/** Two, and the row's button needs to know before it draws. */
export const PROJECT_MENU_ROWS = 2
