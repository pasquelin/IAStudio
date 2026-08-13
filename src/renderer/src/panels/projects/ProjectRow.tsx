import { mdiDotsHorizontal, mdiFolderOutline } from '@mdi/js'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { MenuButton } from '@/design/MenuButton'
import { Row } from '@/design/Row'
import { TIP_LEFT } from '@/helpers/tooltip'
import { timeAgo } from '@/helpers/relative-time'
import { InlineRename } from '@/panels/shared/InlineRename'
import { reportFailure } from '@/services/diagnostics'
import { useProject } from '@/stores/project'
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
 * every other row in the list. The rename field is held here for the same reason — and unlike the
 * explorer, which keeps its own at panel level because a folder watch can tear its rows out from
 * under the field. Nothing tears these rows out: the list is a setting.
 */
export const ProjectRow = memo(function ProjectRow({ project }: ProjectRowProps) {
  const { t, i18n } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)

  // Stable, or the open menu re-subscribes its listeners on every settings write.
  const closeMenu = useCallback(() => setMenuAt(null), [])
  const startRename = useCallback(() => setRenaming(true), [])

  // A hand-edited settings file reaches here: the path alone is what an unreadable date leaves.
  const when = timeAgo(project.openedAt, i18n.language)

  const commitRename = (name: string): void => {
    setRenaming(false)
    if (name === project.name) return

    void useProject
      .getState()
      .rename(project.path, name)
      .catch(error => reportFailure('project.rename', project.path, error))
  }

  return (
    <div
      className="h-full min-w-0"
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      {renaming ? (
        // Both handlers stopped, as the menu button below does it and for a sharper reason: this
        // list opens a project on a SINGLE click, so a click landing in the field would tear down
        // every panel and reload a catalogue while a name was being typed. `InlineRename` stops
        // the pointer press on its own; the click is what it cannot know it has to stop, since
        // the lists it was written for only SELECT on one.
        <span
          className="flex h-full items-center px-1"
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <InlineRename
            value={project.name}
            label={t('home.projects.rename')}
            onCommit={commitRename}
          />
        </span>
      ) : (
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
                rows={close => (
                  <ProjectMenuRows path={project.path} onClose={close} onRename={startRename} />
                )}
              />
            </span>
          }
        />
      )}
      {/* The date lives in the tooltip otherwise, and a tooltip is hover-only: a keyboard walking
          the shelf with the arrows would never reach the answer it exists to give. */}
      {when && !renaming && (
        <span className="sr-only">{t('home.projects.openedAt', { when })}</span>
      )}
      {menuAt && (
        <ProjectMenu path={project.path} at={menuAt} onClose={closeMenu} onRename={startRename} />
      )}
    </div>
  )
})
