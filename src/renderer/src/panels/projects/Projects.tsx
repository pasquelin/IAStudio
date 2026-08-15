import { mdiFolderOpenOutline } from '@mdi/js'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { projectsByCreation, type RecentProject } from '@shared/domain/project'
import { Collection } from '@/design/Collection'
import { EmptyState } from '@/design/EmptyState'
import { reportFailure } from '@/services/diagnostics'
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
 *
 * **Which path a rename is open on is held here, not in the row**, and the double-click is why: it
 * is caught on the row's own wrapper, and only one row may hold a field at a time — two rows each
 * holding their own boolean cannot agree on that.
 *
 * The double-click is deliberately NOT `Collection`'s `onActivate`. That slot is also what Enter
 * fires, and taking it would make Enter rename a row while Space opened it — backwards from every
 * other list in the studio, where Enter opens what is under the keyboard.
 */
export function Projects() {
  const { t } = useTranslation()
  const recent = useSettings(state => state.settings.storage.recentProjects)
  const open = useProject(state => state.project?.path)
  const [renaming, setRenaming] = useState<string | null>(null)

  // Held, or every render of the home hands each row a project of a new identity and `ProjectRow`
  // is memoised against nothing.
  const items: Card[] = useMemo(
    () => projectsByCreation(recent).map(entry => ({ ...entry, id: entry.path })),
    [recent],
  )

  /**
   * The field is closed first, whatever comes back: `InlineRename` commits the ORIGINAL name when
   * the edit was abandoned, and a write fired for that would stamp the manifest for a gesture that
   * said no. The failure goes to the journal — the field is gone by the time an answer arrives.
   *
   * Both of these take the row they act on rather than closing over it, and are held for the
   * panel's lifetime: `renderRow` runs on every render of the collection, so a handler built there
   * hands each row a prop of a new identity and memoises `ProjectRow` against nothing — the very
   * trap the note above `items` was written for, entered by the other door.
   */
  const startRename = useCallback((path: string) => setRenaming(path), [])

  const commitRename = useCallback((project: RecentProject, name: string): void => {
    setRenaming(null)
    if (name === project.name) return

    void useProject
      .getState()
      .rename(project.path, name)
      // A REFUSAL, not a rejection: the store swallows the bridge error and answers `false`, so a
      // `.catch` here could only ever have caught a settings write going wrong — and the rename
      // that did nothing would have passed in silence.
      .then(done => {
        if (!done) reportFailure('project.rename', project.path, new Error('rename refused'))
      })
  }, [])

  return (
    <Collection
      label={t('panels.projects')}
      items={items}
      // `filled` goes with the `strong` tone below and is only ever right beside it: the tone is
      // what paints a fill that stands there, and the height is the room that fill takes off the
      // two steps of text. Every other stacked list paints one only under a pointer.
      rowHeight="filled"
      // The open project, which is at most one — an array because that is the shape a collection
      // takes, not because two could ever be in it.
      selectedIds={open === undefined ? [] : [open]}
      selectionTone="strong"
      // A folder gone from the disk drops out on its own: the store forgets it wherever an
      // opening fails, not only where it was clicked.
      onOpen={project => void useProject.getState().open(project.path)}
      renderRow={project => (
        // The commit handler goes to the row being renamed and to no other: its presence is what
        // opens the field, which is how the explorer says the same thing.
        <ProjectRow
          project={project}
          onRenameStart={startRename}
          onRenameCommit={renaming === project.path ? commitRename : undefined}
        />
      )}
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
