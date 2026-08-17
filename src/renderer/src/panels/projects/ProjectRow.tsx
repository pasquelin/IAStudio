import { mdiDotsHorizontal, mdiFolderOutline } from '@mdi/js'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { useContextMenu } from '@/design/ContextMenu'
import { MenuButton } from '@/design/MenuButton'
import { Row } from '@/design/Row'
import { TIP_LEFT } from '@/helpers/tooltip'
import { timeAgo } from '@/helpers/relative-time'
import { InlineRename } from '@/design/InlineRename'
import { ProjectMenu } from './ProjectMenu/ProjectMenu'
import { ProjectMenuRows, PROJECT_MENU_ROWS } from './ProjectMenu/ProjectMenuRows'

export type ProjectRowProps = {
  project: RecentProject
  /**
   * Asks for the field, naming the row it should open on. Absent leaves the menu row refused
   * rather than dead.
   *
   * The path travels as an argument rather than in a closure, and so does the project below: the
   * panel builds these once, and a handler rebuilt per render would memoise this row against
   * nothing — which is the only thing `memo` here is for.
   */
  onRenameStart?: (path: string) => void
  /**
   * Fired with the new name, or with the old one when the edit was abandoned. **Its presence is
   * what puts this row into its field** — the panel hands it to the one row being renamed and to
   * no other, exactly as the explorer does (`Explorer.tsx`).
   *
   * A separate `renaming` flag beside it would let a caller ask for a field with nothing to
   * commit to, a state the row would then have to defend against on every render.
   */
  onRenameCommit?: (project: RecentProject, name: string) => void
}

/**
 * One recent project: its name, the folder it sits in, and its menu.
 *
 * The PATH is the subtitle rather than the date it was last opened. A studio's projects end up
 * scattered — one under `Documents`, one on a scratch disk, two called `Test` — and the folder is
 * the only thing that tells two rows apart. The date has not gone: it rides in the row's tooltip,
 * which carries the whole path too, since a narrow panel truncates it.
 *
 * The menu is held per row rather than by the panel: lifted, opening one row's menu re-rendered
 * every other row in the list. The RENAME is the other way round and has to be — the double-click
 * that starts it belongs to the collection's cell, not to anything inside this row, so only the
 * panel is in a position to hear it.
 */
export const ProjectRow = memo(function ProjectRow({
  project,
  onRenameStart,
  onRenameCommit,
}: ProjectRowProps) {
  const { t, i18n } = useTranslation()
  const menu = useContextMenu()

  // Where the row's own identity joins the panel's handlers: bound HERE and not in `renderRow`,
  // which runs on every render of the collection and would hand this row a new prop each time.
  const startRename = useCallback(
    () => onRenameStart?.(project.path),
    [onRenameStart, project.path],
  )
  const commitRename = useCallback(
    (name: string) => onRenameCommit?.(project, name),
    [onRenameCommit, project],
  )

  // A hand-edited settings file reaches here: the path alone is what an unreadable date leaves.
  const when = timeAgo(project.openedAt, i18n.language)

  if (onRenameCommit)
    return (
      // Both handlers stopped, as the menu button below does it and for a sharper reason: this
      // list opens a project on a SINGLE click, so a click landing in the field would tear down
      // every panel and reload a catalogue while a name was being typed. `InlineRename` stops the
      // pointer press on its own; the click is what it cannot know it has to stop, since the lists
      // it was written for only SELECT on one.
      <span
        className="flex h-full items-center px-1"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
      >
        <InlineRename
          value={project.name}
          label={t('home.projects.rename')}
          onCommit={commitRename}
        />
      </span>
    )

  return (
    <div
      className="h-full min-w-0"
      onContextMenu={menu.open}
      // The gesture every file manager renames with. Caught here rather than through the
      // collection's `onActivate`, which is also what Enter fires: taking that slot would make
      // Enter rename a row while Space opened it, backwards from every other list in the studio.
      //
      // The single click underneath still opens, and for the row that is already open — the one
      // whose name you double-click — the store refuses to reopen it, so the gesture costs nothing.
      onDoubleClick={startRename}
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
              rows={close => (
                <ProjectMenuRows
                  path={project.path}
                  onClose={close}
                  onRename={onRenameStart && startRename}
                />
              )}
            />
          </span>
        }
      />
      {/* The date lives in the tooltip otherwise, and a tooltip is hover-only: a keyboard walking
          the shelf with the arrows would never reach the answer it exists to give. */}
      {when && <span className="sr-only">{t('home.projects.openedAt', { when })}</span>}
      {menu.at && (
        <ProjectMenu
          path={project.path}
          at={menu.at}
          onClose={menu.close}
          onRename={onRenameStart && startRename}
        />
      )}
    </div>
  )
})
