import { mdiDotsHorizontal, mdiFolderOutline } from '@mdi/js'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { MenuButton } from '@/design/MenuButton'
import { Row } from '@/design/Row'
import { TIP_LEFT } from '@/helpers/tooltip'
import { timeAgo } from '@/helpers/relative-time'
import { ProjectMenu, ProjectMenuRows, PROJECT_MENU_ROWS } from './ProjectMenu'

export type ProjectRowProps = { project: RecentProject }

/**
 * One recent project: its name, the folder it sits in, and its menu.
 *
 * The PATH is the subtitle rather than the date it was last opened. A studio's projects end up
 * scattered — one under `Documents`, one on a scratch disk, two called `Test` — and the folder is
 * the only thing that tells two rows apart. The date has not gone: it rides in the row's tooltip,
 * which carries the whole path too, since a narrow panel truncates it.
 *
 * The menu is held per row rather than by the panel: lifted, opening one row's menu re-rendered
 * every other row in the list.
 */
export const ProjectRow = memo(function ProjectRow({ project }: ProjectRowProps) {
  const { t, i18n } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  // Stable, or the open menu re-subscribes its listeners on every settings write.
  const closeMenu = useCallback(() => setMenuAt(null), [])

  // A hand-edited settings file reaches here: the path alone is what an unreadable date leaves.
  const when = timeAgo(project.openedAt, i18n.language)

  return (
    <div
      className="h-full min-w-0"
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      <Row
        icon={mdiFolderOutline}
        title={project.name}
        subtitle={project.path}
        hint={when ? t('home.projects.rowHint', { path: project.path, when }) : project.path}
        actions={
          // Both handlers stopped, as `VisibilityToggle` does: this list opens a project on a
          // single click, and a press on the menu would open the very project it offers to forget.
          <span
            className="flex shrink-0 items-center"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
          >
            <MenuButton
              icon={mdiDotsHorizontal}
              label={t('home.projects.actions')}
              description={t('home.projects.actionsHint')}
              tooltip={TIP_LEFT}
              variant="header"
              rowCount={PROJECT_MENU_ROWS}
              opensOnClick
              rows={close => <ProjectMenuRows path={project.path} onClose={close} />}
            />
          </span>
        }
      />
      {/* The date lives in the tooltip otherwise, and a tooltip is hover-only: a keyboard walking
          the shelf with the arrows would never reach the answer it exists to give. */}
      {when && <span className="sr-only">{t('home.projects.openedAt', { when })}</span>}
      {menuAt && <ProjectMenu path={project.path} at={menuAt} onClose={closeMenu} />}
    </div>
  )
})
