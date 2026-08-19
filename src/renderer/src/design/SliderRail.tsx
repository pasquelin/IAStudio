import { clamp } from '@shared/numeric'

export type SliderRailProps = {
  /** Where the filled span starts and ends, as percentages of the rail. */
  from: number
  to: number
}

/**
 * The rail every slider of the studio runs on: one thickness, one colour for what is spent and
 * one for what is left. Drawn behind the input rather than by it — a native track wears the
 * browser's own white and cannot be told a gauge, which is how three fields ended up with three
 * different rails.
 *
 * Decoration, never a target: the presses belong to the input stacked over it.
 */
export function SliderRail({ from, to }: SliderRailProps) {
  // Held inside the rail, as a progress bar holds a job reporting 1.02: a value momentarily out
  // of bounds — a document loaded before its span is known — would draw past the control's end.
  const start = clamp(from, 0, 100)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-(--sc-slider-rail) -translate-y-1/2">
      <div className="bg-surface size-full rounded-full" />
      <div
        className="bg-accent absolute inset-y-0 rounded-full"
        style={{ left: `${start}%`, width: `${clamp(to, 0, 100) - start}%` }}
      />
    </div>
  )
}
