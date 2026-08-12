import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { ProjectRow } from './ProjectRow'

/** A recent project needs an `id` to be listed; its folder is already one. */
type Card = RecentProject & { id: string }

/**
 * The projects this studio has opened, newest first — the home's left column, where every space
 * puts what one produces with.
 *
 * Read straight from the settings: the list travels with `lastProject` and every window already
 * holds it, so the panel that makes the home an entry point costs no request and works with no
 * key.
 *
 * A single click opens, which is what `onOpen` announces: a project is not a thing to select.
 */
export function Projects() {
  const { t } = useTranslation()
  const recent = useSettings(state => state.settings.storage.recentProjects)

  const items: Card[] = recent.map(entry => ({ ...entry, id: entry.path }))

  return (
    <Collection
      label={t('panels.projects')}
      items={items}
      rowHeight="stacked"
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
