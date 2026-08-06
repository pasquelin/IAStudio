import { useTranslation } from 'react-i18next'
import { TIP_RIGHT } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { useTools } from '@/stores/tools'
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
 * An edge's icon rail, IDE-style: it stays in place when the zone is closed, and is the only
 * way to reopen a tool you just closed.
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
      <RailGroup zones={top} />
      {bottom.length > 0 && <RailGroup zones={bottom} />}
    </div>
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
