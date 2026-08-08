import { mdiCogOutline, mdiFolderOpenOutline, mdiFolderPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { WORKSPACES, workspaceLabelKey } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { enterWorkspace } from '../open'
import { Section } from '../Section'

type Entry = {
  key: string
  icon: string
  label: string
  help: string
  onClick: () => void
}

/**
 * What the studio can do, grouped by what one is about to do rather than by where the code
 * lives. It is the one section that works on a machine with no key, no project and no history,
 * which is why it is pinned: a home that says nothing about the application is not an entry
 * point, it is a wall.
 */
export function Tools() {
  const { t } = useTranslation()

  const create: Entry[] = WORKSPACES.map(workspace => ({
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
    <Section id="tools" title={t('home.sections.tools')}>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr]">
        <Group
          title={t('home.tools.createGroup')}
          entries={create}
          // Six of them read as a grid, three as a list: the same entries in one column each
          // would leave the create group twice as tall as the one beside it.
          columns={2}
        />
        {/* Named for what it holds, not for the state the studio is in: these three entries are
            about projects whether one is open or not. */}
        <Group title={t('home.tools.projectGroup')} entries={manage} columns={1} />
      </div>
    </Section>
  )
}

type GroupProps = {
  title: string
  entries: readonly Entry[]
  columns: 1 | 2
}

function Group({ title, entries, columns }: GroupProps) {
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-(--radius-sc-lg) p-3">
      <h3 className="text-muted m-0 text-[10px] font-semibold tracking-wider uppercase">{title}</h3>

      <div className={cn('grid gap-1', columns === 2 && 'sm:grid-cols-2')}>
        {entries.map(entry => (
          <button
            key={entry.key}
            type="button"
            onClick={entry.onClick}
            className={cn(
              'hover:bg-elevated flex cursor-pointer items-start gap-2.5 text-left',
              'rounded-(--radius-sc-md) border-none bg-transparent p-2 transition-colors',
              FOCUS_RING,
            )}
          >
            <UiIcon path={entry.icon} size={18} className="text-muted mt-0.5 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text truncate text-[12px]">{entry.label}</span>
              <span className="text-muted text-[11px] leading-snug">{entry.help}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
