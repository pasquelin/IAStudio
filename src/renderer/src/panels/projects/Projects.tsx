import { mdiFolderOpenOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { projectsByCreation, type RecentProject } from '@shared/domain/project'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { ProjectRow } from './ProjectRow'

/** A recent project needs an `id` to be listed; its folder is already one. */
type Card = RecentProject & { id: string }

/**
 * The projects this studio has opened, newest-made first — the home's left column, and since
 * 13 August the only panel in it.
 *
 * Read straight from the settings: the list travels with `lastProject` and every window already
 * holds it, so the panel that makes the home an entry point costs no request and works with no
 * key.
 *
 * **The order is the creation date and not the stored one, and that is the fix rather than a
 * preference**: the settings keep the list by most-recently-opened, so the click that opened a
 * project moved it to the top and the whole list shuffled under the pointer that had just aimed
 * at it. `projectsByCreation` gives a key no click can move.
 *
 * A single click opens, which is what `onOpen` announces: a project is not a thing to select. What
 * `selectedIds` paints here is therefore not a selection but WHERE ONE IS — the folder the studio
 * has open — which is why the tone is `strong` and why the row keeps its `listitem` role.
 */
export function Projects() {
  const { t } = useTranslation()
  const recent = useSettings(state => state.settings.storage.recentProjects)
  const open = useProject(state => state.project?.path)

  // Held, or every render of the home hands each row a project of a new identity and `ProjectRow`
  // is memoised against nothing.
  const items: Card[] = useMemo(
    () => projectsByCreation(recent).map(entry => ({ ...entry, id: entry.path })),
    [recent],
  )

  return (
    <Collection
      label={t('panels.projects')}
      items={items}
      rowHeight="stacked"
      // The open project, which is at most one — an array because that is the shape a collection
      // takes, not because two could ever be in it.
      selectedIds={open === undefined ? [] : [open]}
      selectionTone="strong"
      // A folder gone from the disk drops out on its own: the store forgets it wherever an
      // opening fails, not only where it was clicked.
      onOpen={project => void useProject.getState().open(project.path)}
      renderRow={project => <ProjectRow project={project} />}
      // The one screen a first launch actually shows. It says what to do rather than that there
      // is nothing: a studio with no project yet is a studio about to have one.
      empty={
        <EmptyState
          icon={mdiFolderOpenOutline}
          message={t('home.projects.none')}
          action={{
            label: t('project.create'),
            hint: t('project.createHint'),
            onClick: () => void useProject.getState().createPicked(),
          }}
          secondary={{
            label: t('project.open'),
            hint: t('project.openHint'),
            onClick: () => void useProject.getState().openPicked(),
          }}
        />
      }
    />
  )
}
