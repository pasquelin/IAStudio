import { mdiLoading } from '@mdi/js'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

export type SpinnerProps = {
  /**
   * What is running. A spinner is the one control whose whole meaning is motion, and motion is
   * exactly what a screen reader cannot relay — unnamed, it is announced as nothing at all.
   */
  label: string
  size?: number
  className?: string
}

/**
 * Something is happening and nobody can say how far along it is.
 *
 * Deliberately NOT a `ProgressBar` with a made-up ratio: the two answer different questions, and
 * a bar that fills on a guess is a promise the studio cannot keep. Where a real fraction exists —
 * a generation reports one — the bar is the right thing and this is not.
 *
 * `role="status"` rather than `progressbar`: there is no value to announce, only the fact that
 * the wait is on.
 *
 * Under `data-reduce-motion` the rotation stops, and what remains is a glyph that no longer says
 * anything by itself. Every site must therefore carry the meaning elsewhere too — the asset
 * browser dims the whole cell and marks its corner, and the spinner is the third of three.
 */
export function Spinner({ label, size = 24, className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <UiIcon path={mdiLoading} size={size} className="animate-spin" />
    </span>
  )
}
