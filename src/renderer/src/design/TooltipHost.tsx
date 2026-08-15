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
      /* Long enough that crossing a dense panel raises nothing: `Row` tips every name it draws,
         whether or not it was cut off, so the pointer sweeping a stack of them left a trail of
         bubbles behind it. The wait treats the symptom — the cure is a condition in `Row`, which
         nothing measures today — and it is paid by every control in the studio, icon-only
         buttons included, whose tooltip is the only thing naming them on screen. */
      delayShow={1000}
      offset={8}
      noArrow
      /* The same plate a menu wears — `MENU_SURFACE`'s pair, a `surface` fill inside a `border`
         line — rather than a lone `elevated` block: a bubble floats over panels, tiles and the
         canvas alike, and only the line tells it apart from whatever it covers. Tight with it:
         a tooltip is one line read in passing, and the padding a menu row needs to be clicked
         made it a plaque.

         Wrapped at `--sc-tooltip` rather than running as wide as its longest line — see
         `index.css`. `break-words` with it: a path or an id has no space to wrap at, and would
         push the bubble back past the measure this sets. */
      /* `opacity-100` because the library ships 0.9: at that value the border it is drawn with
         washes into whatever it floats over, and the bubble reads as a smudge rather than a
         plate. Measured through CDP, not deduced — the class list was already right. */
      className="bg-surface! border-border! text-text! text-tiny! z-50! max-w-(--sc-tooltip)! rounded-(--radius-sc-md)! border! px-2! py-1! break-words! opacity-100! shadow-(--sc-shadow-floating)!"
    />
  )
}
