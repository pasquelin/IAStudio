import {
  mdiFolderOpenOutline,
  mdiFolderOutline,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import { TitleBarSelect } from '@/design/TitleBarSelect'
import { UiIcon } from '@/design/UiIcon'
import { revealTool } from '@/helpers/revealPanel'
import { toolIcon } from '@/helpers/toolRegistry'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { projectsByCreation } from '@shared/domain/project'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'

/**
 * Which project the studio has open, and the way into another one — the bar's right end, beside
 * the account.
 *
 * Both belong there and they answer different questions: the account is the remote key one
 * generates on, this is the folder on disk everything is written into. The pair reads local then
 * remote, in that order.
 *
 * ONE project is open at a time — the main process owns that, and opening another closes the
 * first. So the menu lists what has been opened before rather than what is open now: the ticked
 * row IS the open one, and every other row is a switch.
 *
 * Ordered by creation date, the same key the home's panel uses. One list must not be read in two
 * orders — and the stored order reshuffles on every opening, which in a MENU means the row under
 * the pointer is not the row that was aimed at.
 */
export function ProjectSelect() {
  const { t } = useTranslation()

  const project = useProject(state => state.project)
  const known = useProject(state => state.known)
  const stored = useSettings(state => state.settings.storage.recentProjects)
  const recent = projectsByCreation(stored)

  // Nothing until the main process has said which project is open, as the home waits for the
  // same answer. The initial `null` is "not asked yet", and the studio reopens the last project
  // on launch: drawn straight away, the chrome states « no project open » to everyone who has
  // one, and a screen reader reads that statement out before it is taken back.
  if (!known) return null

  const name = project?.manifest.name ?? t('project.none')

  return (
    <TitleBarSelect
      leading={<UiIcon path={mdiFolderOutline} size={12} className="shrink-0" />}
      label={name}
      // The name CONTAINS what the eye reads (WCAG 2.5.3): the visible text is the project, and
      // a name of "Project" alone would answer to a word nowhere on the button.
      name={t('project.switch', { name })}
      hint={t('project.switchHint')}
      // The folders, plus the two ways to a project that is not among them, plus the two rows that
      // act on the OPEN one. Never fewer than two, so this button always has a menu — which is
      // why it hands `TitleBarSelect` no `onAct`.
      rowCount={recent.length + (project ? 4 : 2)}
      width="max-w-52"
      rows={close => (
        <>
          {recent.map(entry => {
            const current = entry.path === project?.path
            return (
              <MenuRow
                key={entry.path}
                label={entry.name}
                icon={mdiFolderOutline}
                checked={current}
                tick="one-of"
                // The open one is a no-op — the store refuses it — so it must not be the row
                // that promises to close what is open and take its place.
                tip={HINT_RIGHT(t(current ? 'project.currentHint' : 'project.useHint'))}
                onSelect={() => {
                  close()
                  // The refusal lives in the store, so it covers the home's shelf of recent
                  // projects too: reopening the one in front reloads a whole catalogue to land
                  // on the folder already there.
                  void useProject.getState().open(entry.path)
                }}
              />
            )
          })}

          {recent.length > 0 && <Separator orientation="horizontal" className="self-center" />}

          {/* Between the two groups because it belongs to neither: every row above SWITCHES the
              open project and every row below leaves it, where this one acts on it. */}
          {project !== null && (
            <>
              <MenuRow
                label={t('project.context')}
                icon={toolIcon('context')}
                tip={HINT_RIGHT(t('project.contextHint'))}
                onSelect={() => {
                  close()
                  revealTool('context')
                }}
              />
              {/* The shelf's « forget » is the other gesture: it drops a row and leaves the
                  project open. This one leaves the studio on the home, with the row where it was. */}
              <MenuRow
                label={t('project.close')}
                icon={mdiFolderRemoveOutline}
                tip={HINT_RIGHT(t('project.closeHint'))}
                onSelect={() => {
                  close()
                  void useProject.getState().close()
                }}
              />
              <Separator orientation="horizontal" className="self-center" />
            </>
          )}

          <MenuRow
            label={t('project.create')}
            icon={mdiFolderPlusOutline}
            tip={HINT_RIGHT(t('project.createHint'))}
            onSelect={() => {
              close()
              void useProject.getState().createPicked()
            }}
          />
          <MenuRow
            label={t('project.open')}
            icon={mdiFolderOpenOutline}
            tip={HINT_RIGHT(t('project.openHint'))}
            onSelect={() => {
              close()
              void useProject.getState().openPicked()
            }}
          />
        </>
      )}
    />
  )
}
