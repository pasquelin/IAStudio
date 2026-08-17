import type { ClipRow } from '@/engines/scene/animation-rows'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { TimelineRow } from '../TimelineRow/TimelineRow'

/** A block names the clip it plays, and offers nothing else: it is driven from the inspector. */
export function AnimationHeadersClip({ row }: { row: ClipRow }) {
  return (
    <TimelineRow height={row.height} nested data-testid={`anim-clip-${row.nodeId}`}>
      <span className="text-muted text-tiny min-w-0 truncate" {...HINT_RIGHT(row.name)}>
        {row.name}
      </span>
    </TimelineRow>
  )
}
