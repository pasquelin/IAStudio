import { mdiPlus } from '@mdi/js'
import { kindForWorkspace } from '@shared/domain/document'
import { useTranslation } from 'react-i18next'
import { Separator } from '@/design/Separator'
import { TIP_RIGHT } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useTools } from '@/stores/tools'
import { openDocument } from './DocumentArea'
import { toolsInZone, toolTitleKey, type ToolZone } from './tools'

export type RailProps = {
  /** Edge the rail sticks to. The left rail also carries the bottom strip's tools. */
  side: 'left' | 'right'
}

const ZONES_BY_SIDE: Record<'left' | 'right', { top: ToolZone[]; bottom: ToolZone[] }> = {
  left: { top: ['left', 'top'], bottom: ['bottom'] },
  right: { top: ['right'], bottom: [] },
}

/**
 * An edge's icon rail, IDE-style: it stays in place when the zone is closed, so a closed tool
 * is always one click away. "View ▸ Tool windows" in the native menu is the second way back.
 *
 * The left rail is split into two groups — left-column tools at the top, bottom-strip tools
 * at the bottom — so that an icon's position tells where the tool will open.
 */
export function Rail({ side }: RailProps) {
  const { top, bottom } = ZONES_BY_SIDE[side]

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      className="flex w-(--sc-rail) shrink-0 flex-col items-center justify-between py-(--sc-gutter)"
    >
      <div className="flex flex-col items-center gap-1">
        {side === 'left' && (
          <>
            <NewDocumentButton />
            <Separator orientation="horizontal" />
          </>
        )}
        <RailGroup zones={top} />
      </div>
      {bottom.length > 0 && <RailGroup zones={bottom} />}
    </div>
  )
}

/**
 * Above the tool icons rather than in the Explorer header: it stays reachable when every panel
 * is closed. Disabled — not hidden — where no editor exists yet: a button that vanishes reads
 * as a display bug.
 */
function NewDocumentButton() {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)

  return (
    <ToolButton
      icon={mdiPlus}
      iconSize={22}
      label={t('documents.new')}
      tooltip={TIP_RIGHT}
      disabled={kindForWorkspace(workspace) === null}
      onClick={() => {
        const created = useDocuments.getState().create(workspace)
        if (created) openDocument(created)
      }}
      // Accent-coloured, unlike every tool icon around it: this one acts, the others only
      // switch what is shown. A grey plus among grey glyphs is a plus nobody finds.
      className="text-accent bg-accent-soft/40 hover:bg-accent size-(--sc-rail-button) rounded-(--radius-sc-md) hover:text-white disabled:bg-transparent"
    />
  )
}

function RailGroup({ zones }: { zones: ToolZone[] }) {
  const { t } = useTranslation()
  // Reading the store here rather than receiving props keeps a rail click from re-rendering
  // the Shell — and with it the Dockview host at the center.
  const open = useTools(state => state.open)
  const focusedZone = useTools(state => state.focusedZone)
  const toggle = useTools(state => state.toggle)

  return (
    <div className="flex flex-col items-center gap-1">
      {zones.flatMap(zone =>
        toolsInZone(zone).map(tool => {
          const isOpen = open[zone] === tool.id
          return (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              iconSize={22}
              label={t(toolTitleKey(tool.id))}
              tooltip={TIP_RIGHT}
              active={isOpen}
              accented={isOpen && focusedZone === zone}
              onClick={() => toggle(zone, tool.id)}
              className="size-(--sc-rail-button) rounded-(--radius-sc-md)"
            />
          )
        }),
      )}
    </div>
  )
}
