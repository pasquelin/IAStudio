import { cn } from '@/helpers/cn'

/**
 * How many of a family's employments are served, as dots.
 *
 * A tally alone left eight rows of « aucun emploi servi » reading as eight identical lines, with
 * nothing for the eye to land on. Dots rather than a bar: the numbers here are two to six, and a
 * bar at a sixth of its width says « nearly nothing » about a family that has one of six.
 *
 * `bg-accent` is the studio's FILLED GAUGE, which is one of the three things the full accent is
 * for. It lives in its own file because `styles.test.ts` refuses that token in any file that also
 * calls `rowSkin` — a rule that reads the file rather than the element.
 */
export function ModelInventoryGauge({ served, total }: { served: number; total: number }) {
  return (
    <span aria-hidden className="flex shrink-0 gap-0.5">
      {Array.from({ length: total }, (_unused, rank) => (
        <span
          key={rank}
          className={cn('size-1.5 rounded-full', rank < served ? 'bg-accent' : 'bg-elevated')}
        />
      ))}
    </span>
  )
}
