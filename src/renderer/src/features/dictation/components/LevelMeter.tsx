import { cn } from '@/helpers/cn'
import { useDictation } from '@/stores/dictation'

export type LevelMeterProps = {
  /**
   * What it is called for a reader. Absent makes it decorative, which is right wherever a phrase
   * beside it already says the microphone is on — repeating that in an image label is noise.
   */
  label?: string
}

/**
 * The input level, as five bars that fill from the left.
 *
 * Bars rather than a number: what it is there to answer is "is it hearing me", and a figure makes
 * that a reading exercise.
 *
 * It reads the store itself rather than taking the level as a prop, so ten updates a second
 * re-render these five bars and nothing else — not the button above them, not the field they sit
 * under, and not the four other indicators of the status line. Quantised in the selector, so a
 * level that wobbles without lighting another bar renders nothing at all.
 */
export function LevelMeter({ label }: LevelMeterProps = {}) {
  // Compressed, not linear: speech sits low in the range, and a linear meter barely moves.
  const lit = useDictation(store => Math.min(5, Math.ceil(Math.sqrt(store.level) * 5)))

  return (
    <span
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      className="flex items-end gap-0.5"
    >
      {[1, 2, 3, 4, 5].map(bar => (
        <span
          key={bar}
          className={cn(
            'w-0.5 rounded-(--radius-sc-sm) transition-[background-color]',
            bar <= lit ? 'bg-accent' : 'bg-elevated',
          )}
          style={{ height: `${2 + bar * 2}px` }}
        />
      ))}
    </span>
  )
}
