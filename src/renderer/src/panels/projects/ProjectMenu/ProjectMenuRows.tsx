import { mdiFolderOpenOutline, mdiPlaylistRemove, mdiRenameOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useProject } from '@/stores/project'

export type ProjectMenuRowsProps = {
  path: string
  onClose: () => void
  /**
   * Puts the row into its rename field. Optional so the menu can be offered where no field can
   * open — nowhere today, and the row is what owns the field, as the explorer's does.
   */
  onRename?: () => void
}

/** Three, and the row's button needs to know before it draws. */
export const PROJECT_MENU_ROWS = 3

/**
 * What can be done to a recent project without opening it, as rows.
 *
 * Three, and **none of them deletes anything**: one shows the folder in the system's file
 * manager, one RENAMES it — a project is named by its folder — and one drops it from the shelf.
 * Reopening the project puts a forgotten row back, which is what makes the last row safe to offer
 * with no confirmation behind it.
 *
 * Rendered by two things — the right-click menu and the row's own button — because a right-click
 * is not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused cell, not the div
 * inside it that listens.
 */
export function ProjectMenuRows({ path, onClose, onRename }: ProjectMenuRowsProps) {
  const { t } = useTranslation()

  // The menu is gone by the time an answer comes, so a failure travels to the journal rather than
  // nowhere — as the asset menu's own reveal does. Both of the rows that reach the disk can
  // genuinely fail: the main process refuses a path that is not absolute, and the settings write
  // can be refused by the disk. The rename is the exception and reports nothing here — it opens a
  // field, and what that field commits is answered where the row owns it.
  return (
    <>
      <MenuRow
        label={t('home.projects.reveal')}
        icon={mdiFolderOpenOutline}
        tip={HINT_RIGHT(t('home.projects.revealHint'))}
        onSelect={() => {
          void getBridge()
            ?.project.revealFolder(path)
            .then(shown => {
              if (!shown) reportFailure('project.reveal', path, new Error('folder not found'))
            })
            .catch(error => reportFailure('project.reveal', path, error))
          onClose()
        }}
      />
      <MenuRow
        label={t('home.projects.rename')}
        icon={mdiRenameOutline}
        // Absent rather than dead when no field can open, as the rail drops the generator it
        // cannot offer: a row that explains nothing and does nothing is the worst outcome.
        disabled={onRename === undefined}
        tip={HINT_RIGHT(t('home.projects.renameHint'))}
        onSelect={() => {
          onClose()
          onRename?.()
        }}
      />
      <MenuRow
        label={t('home.projects.forget')}
        icon={mdiPlaylistRemove}
        tip={HINT_RIGHT(t('home.projects.forgetHint'))}
        onSelect={() => {
          void useProject
            .getState()
            .forget(path)
            .catch(error => reportFailure('project.forget', path, error))
          onClose()
        }}
      />
    </>
  )
}
