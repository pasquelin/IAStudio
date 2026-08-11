import type { Us } from '@shared/domain/time'
import { formatTimecode } from '@/engines/timeline/timecode'
import { cn } from '@/helpers/cn'

export type TimecodeProps = {
  time: Us
  fps: number
  className?: string
}

/**
 * `HH:MM:SS:FF`, in one place. Both monitors, the status bar and a scene's animation band show
 * one, and copies of the same tabular-figures rule are chances for them to drift apart.
 */
export function Timecode({ time, fps, className }: TimecodeProps) {
  return (
    <span className={cn('text-muted text-tiny px-1 font-mono tabular-nums', className)}>
      {formatTimecode(time, fps)}
    </span>
  )
}
