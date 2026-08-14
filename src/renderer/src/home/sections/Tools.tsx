import { mdiCogOutline, mdiFolderOpenOutline, mdiFolderPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { rowSkin, TILE_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'
import { workspaceLabelKey } from '@/helpers/workspaces'
import { useWorkspaces } from '@/hooks/useWorkspaces'
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
 * lives. It is the one band that works on a machine with no key, no project and no history,
 * which is why it is pinned.
 *
 * It spent a day as a panel in the home's upper left and came back: ten entries in two groups
 * read ACROSS in a grid, and a 320-pixel column stacked them into a ladder taller than the
 * screen. The width is the whole point of the band.
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
    <Section id="tools" title={t('home.sections.tools')}>
      <div className="flex flex-col gap-3">
        <Group title={t('home.tools.createGroup')} entries={create} />
        {/* Named for what it holds, not for the state the studio is in: these three entries are
            about projects whether one is open or not. */}
        <Group title={t('home.tools.projectGroup')} entries={manage} />
      </div>
    </Section>
  )
}

function Group({ title, entries }: { title: string; entries: readonly Entry[] }) {
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-(--radius-sc-lg) p-3">
      <h3 className="text-muted text-mini m-0 font-semibold tracking-wider uppercase">{title}</h3>

      {/* Tracks the CENTRE rather than the window: Tailwind's breakpoints answer to the viewport,
          and the panel columns beside this band take a third of it without moving one.
          `min(…,100%)` is what keeps the floor from becoming an overflow: the centre is clamped
          at `MIN_CENTER` = 240, which leaves this grid ~168, and the page hides its overflow. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2">
        {entries.map(entry => (
          <button
            key={entry.key}
            type="button"
            // The entry's own help, under the pointer: it is drawn under the label, and a narrow
            // cell clamps it before the button goes with it. Opening up, as the band's own
            // controls do — the page scrolls, and a tip below the last row opens off screen.
            {...HINT_TOP(entry.help)}
            onClick={entry.onClick}
            // `rowSkin` rather than the hover and the focus ring written out again — the same
            // answer to "the pointer is here" as every list row. Its radius is overridden below:
            // a tile of the home is wider than a line and takes the larger one.
            className={cn(
              rowSkin(false, { surface: 'tile' }),
              'flex cursor-pointer items-start gap-2.5 text-left',
              'rounded-(--radius-sc-md) border-none bg-transparent p-2 transition-colors',
            )}
          >
            <UiIcon path={entry.icon} size={18} className="text-muted mt-0.5 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text truncate text-xs leading-normal">{entry.label}</span>
              {/* `TILE_QUIET` and not `ROW_QUIET`: `muted` reads 3.51:1 on `elevated`, the fill
                  this tile takes on hover, and a tile is the last surface in the studio that still
                  takes one — a list row stopped on 2026-08-14. */}
              <span className={cn(TILE_QUIET, 'text-tiny line-clamp-2 leading-snug')}>
                {entry.help}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
