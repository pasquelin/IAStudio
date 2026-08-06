import { useTranslation } from 'react-i18next'
import { simpleTooltip } from '@/design/tooltip'
import { ToolButton } from '@/design/ToolButton'
import { toolsInZone, toolTitleKey, type ToolId, type ToolZone } from './tools'

export type RailProps = {
  /** Edge the rail sticks to. The left rail also carries the bottom strip's tools. */
  side: 'left' | 'right'
  open: Partial<Record<ToolZone, ToolId | null>>
  focusedZone: ToolZone | null
  onToggle: (zone: ToolZone, tool: ToolId) => void
}

/**
 * An edge's icon rail, IDE-style: it stays in place when the zone is closed, and is the only
 * way to reopen a tool you just closed.
 *
 * The left rail is split into two groups — left-column tools at the top, bottom-strip tools
 * at the bottom — so that an icon's position tells where the tool will open.
 */
export function Rail({ side, open, focusedZone, onToggle }: RailProps) {
  const topZones: ToolZone[] = side === 'left' ? ['left', 'top'] : ['right']
  const bottomZones: ToolZone[] = side === 'left' ? ['bottom'] : []

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      className="flex w-(--sc-rail) shrink-0 flex-col items-center justify-between py-(--sc-gutter)"
    >
      <RailGroup zones={topZones} open={open} focusedZone={focusedZone} onToggle={onToggle} />
      <RailGroup zones={bottomZones} open={open} focusedZone={focusedZone} onToggle={onToggle} />
    </div>
  )
}

function RailGroup({
  zones,
  open,
  focusedZone,
  onToggle,
}: {
  zones: ToolZone[]
  open: Partial<Record<ToolZone, ToolId | null>>
  focusedZone: ToolZone | null
  onToggle: (zone: ToolZone, tool: ToolId) => void
}) {
  const { t } = useTranslation()
  const tooltip = simpleTooltip('right')

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
              tooltip={tooltip}
              active={isOpen}
              accented={isOpen && focusedZone === zone}
              onClick={() => onToggle(zone, tool.id)}
              className="size-(--sc-rail-button) rounded-(--radius-sc-md)"
            />
          )
        }),
      )}
    </div>
  )
}
