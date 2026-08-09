import { Tooltip } from 'react-tooltip'
import { TOOLTIP_ID } from '@/helpers/tooltip'

/**
 * Shared tooltip, mounted once at the root. One `<Tooltip>` per button would multiply
 * portals and listeners for an identical result.
 *
 * Escape closes it: where a tooltip is the only thing that shows a sentence, it is content
 * rather than decoration, and content has to go away without the pointer having to move.
 *
 * `clickable` is what makes it hoverable (WCAG SC 1.4.13): it lifts the core sheet's
 * `pointer-events: none`, so the pointer can cross the `offset` gap and sweep the bubble instead
 * of dismissing it. A shown bubble then sits in the hit test of whatever it floats above — the
 * trade every hoverable tooltip makes, bounded by the 100 ms hide the flag brings with it.
 */
export function TooltipHost() {
  return (
    <Tooltip
      id={TOOLTIP_ID}
      clickable
      globalCloseEvents={{ escape: true }}
      delayShow={450}
      offset={8}
      noArrow
      className="bg-elevated! text-text! z-50! rounded-(--radius-sc-sm)! px-2! py-1! text-[11px]! shadow-(--sc-shadow-floating)!"
    />
  )
}
