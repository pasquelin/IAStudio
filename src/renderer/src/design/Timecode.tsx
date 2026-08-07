import { formatTimecode } from '@/engines/timeline/timecode'
import type { SequenceSettings, Us } from '@/engines/timeline/timeline-state'
import { cn } from '@/helpers/cn'

export type TimecodeProps = {
  time: Us
  settings: SequenceSettings
  className?: string
}

/**
 * `HH:MM:SS:FF`, in one place. Both monitors and the status bar show one, and three copies of
 * the same tabular-figures rule is three chances for them to drift apart.
 */
export function Timecode({ time, settings, className }: TimecodeProps) {
  return (
    <span className={cn('text-muted px-1 font-mono text-[11px] tabular-nums', className)}>
      {formatTimecode(time, settings)}
    </span>
  )
}
