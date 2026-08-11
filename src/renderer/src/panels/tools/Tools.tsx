import { mdiCogOutline, mdiFolderOpenOutline, mdiFolderPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { workspaceLabelKey } from '@/helpers/workspaces'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { enterWorkspace } from '@/home/open'

type Entry = {
  key: string
  icon: string
  label: string
  help: string
  onClick: () => void
}

/**
 * What the studio can do, grouped by what one is about to do rather than by where the code
 * lives. It is the one panel that works on a machine with no key, no project and no history,
 * which is why it holds the home's upper left — the half every other surface keeps for
 * generation, and the home has nothing to generate.
 *
 * One column, always: these entries are read down, and Tailwind's breakpoints answer to the
 * window rather than to the panel, so a `sm:` grid here would cut a 320-pixel column in two on
 * any screen wide enough to be worth having.
 */
export function Tools() {
  const { t } = useTranslation()

  const create: Entry[] = useWorkspaces().map(workspace => ({
    key: workspace.id,
    icon: workspace.icon,
    label: t(workspaceLabelKey(workspace.id)),
    help: t(`home.tools.${workspace.id}`),
    onClick: () => enterWorkspace(workspace.id),
  }))

  const manage: Entry[] = [
    {
      key: 'new-project',
      icon: mdiFolderPlusOutline,
      label: t('home.tools.newProject'),
      help: t('home.tools.newProjectHelp'),
      onClick: () => void useProject.getState().createPicked(),
    },
    {
      key: 'open-project',
      icon: mdiFolderOpenOutline,
      label: t('home.tools.openProject'),
      help: t('home.tools.openProjectHelp'),
      onClick: () => void useProject.getState().openPicked(),
    },
    {
      key: 'settings',
      icon: mdiCogOutline,
      label: t('home.tools.settings'),
      help: t('home.tools.settingsHelp'),
      onClick: () => void getBridge()?.settings.open('general'),
    },
  ]

  return (
    <div className="flex flex-col gap-2 p-2">
      <Group title={t('home.tools.createGroup')} entries={create} />
      {/* Named for what it holds, not for the state the studio is in: these three entries are
          about projects whether one is open or not. */}
      <Group title={t('home.tools.projectGroup')} entries={manage} />
    </div>
  )
}

function Group({ title, entries }: { title: string; entries: readonly Entry[] }) {
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-(--radius-sc-lg) p-2">
      <h3 className="text-muted text-mini m-0 font-semibold tracking-wider uppercase">{title}</h3>

      <div className="flex flex-col gap-2">
        {entries.map(entry => (
          <button
            key={entry.key}
            type="button"
            // The entry's own help, under the pointer: it is drawn under the label, and a
            // narrow column truncates it before the button goes with it. Placed right, as
            // everything in the left column is.
            {...HINT_RIGHT(entry.help)}
            onClick={entry.onClick}
            className={cn(
              'hover:bg-elevated flex cursor-pointer items-start gap-2.5 text-left',
              'rounded-(--radius-sc-md) border-none bg-transparent p-2 transition-colors',
              FOCUS_RING,
            )}
          >
            <UiIcon path={entry.icon} size={18} className="text-muted mt-0.5 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text truncate text-xs leading-normal">{entry.label}</span>
              <span className="text-muted text-tiny line-clamp-2 leading-snug">{entry.help}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
