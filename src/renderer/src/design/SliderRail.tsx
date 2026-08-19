import { memo } from 'react'
import { clamp, percentIn } from '@shared/numeric'

export type SliderRailProps = {
  /** The filled span, in the values the handles carry rather than in percentages. */
  from: number
  to: number
  min: number
  max: number
}

/**
 * The rail every slider of the studio runs on: one thickness, one colour for what is spent and
 * one for what is left. Decoration, never a target — the presses belong to the input over it.
 *
 * Memoised because an inspector stacks a dozen of them and repaints on every frame of a drag,
 * where only the rail being dragged has new bounds.
 */
export const SliderRail = memo(function SliderRail({ from, to, min, max }: SliderRailProps) {
  const start = clamp(percentIn(from, min, max), 0, 100)

  return (
    <div className="bg-surface pointer-events-none absolute inset-x-0 top-1/2 h-(--sc-slider-rail) -translate-y-1/2 rounded-full">
      <div
        className="bg-accent absolute inset-y-0 rounded-full"
        style={{
          left: `${start}%`,
          width: `${clamp(percentIn(to, min, max), 0, 100) - start}%`,
        }}
      />
    </div>
  )
})
