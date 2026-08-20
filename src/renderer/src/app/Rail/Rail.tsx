import { Separator } from '@/design/Separator'
import type { ToolZone } from '@shared/domain/tool'
import { RailGroup } from './RailGroup'
import { RailNewButton } from './RailNewButton'

export type RailProps = {
  /** Edge the rail sticks to. Each rail also carries the band's half on its own side. */
  side: 'left' | 'right'
}

const ZONES_BY_SIDE: Record<'left' | 'right', { top: ToolZone[]; bottom: ToolZone[] }> = {
  left: { top: ['left', 'top'], bottom: ['bottomLeft'] },
  right: { top: ['right'], bottom: ['bottomRight'] },
}

/**
 * An edge's icon rail, IDE-style: it stays in place when the zone is closed, so a closed tool
 * is always one click away. "View ▸ Tool windows" in the native menu is the second way back.
 *
 * Each rail is split into two groups — its column's tools at the top, its half of the bottom
 * band at the foot — so that an icon's position tells where the tool will open.
 */
export function Rail({ side }: RailProps) {
  const { top, bottom } = ZONES_BY_SIDE[side]

  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      className="flex w-(--sc-rail) shrink-0 flex-col items-center justify-between py-(--sc-gutter)"
    >
      <div className="flex flex-col items-center gap-2">
        {side === 'left' && (
          <>
            <RailNewButton />
            <Separator orientation="horizontal" />
          </>
        )}
        {top.map(zone => (
          <RailGroup key={zone} zone={zone} />
        ))}
      </div>
      {bottom.map(zone => (
        <RailGroup key={zone} zone={zone} />
      ))}
    </div>
  )
}
