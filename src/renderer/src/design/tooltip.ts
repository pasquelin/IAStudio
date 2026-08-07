/**
 * Tooltip attribute factory — the equivalent of map3D's `useTip`. Returns the attributes to
 * spread on the button; the accessible name carries the shortcut whether a tooltip exists or
 * not: a button without a tooltip is never a button without an accessible name.
 *
 * `description` is what separates the two. Screen readers want a short name, and a tooltip that
 * only repeats a label already on screen is noise — a slider labelled `Hardness` says nothing
 * new by tipping `Hardness`. Given a description, the name stays terse and the tooltip explains.
 */
export type TooltipFactory = (
  label: string,
  shortcut?: string | false,
  description?: string,
) => Record<string, string>

/** Id of the shared `<Tooltip>`, mounted once at the root. */
export const TOOLTIP_ID = 'sc-tooltip'

type TooltipPlace = 'top' | 'right' | 'left' | 'bottom'

export function withShortcut(label: string, shortcut?: string | false): string {
  return shortcut ? `${label} (${shortcut})` : label
}

function makeTooltip(place: TooltipPlace): TooltipFactory {
  return (label, shortcut, description) => {
    const name = withShortcut(label, shortcut)
    return {
      'aria-label': name,
      'data-tooltip-id': TOOLTIP_ID,
      // The shortcut rides along with the description too: it is the half of the tooltip nobody
      // can guess, and dropping it would make the explained controls the least documented ones.
      'data-tooltip-content': description ? withShortcut(description, shortcut) : name,
      'data-tooltip-place': place,
    }
  }
}

/**
 * Shared instances, one per placement. A factory built inside a component body would
 * allocate a new closure on every render and hand a new prop identity to every button.
 */
export const TIP_TOP = makeTooltip('top')
export const TIP_RIGHT = makeTooltip('right')
export const TIP_LEFT = makeTooltip('left')
export const TIP_BOTTOM = makeTooltip('bottom')

/**
 * Where a bar's tooltips go, so a floating bar never tips over its own canvas. `bar` is the
 * buttons' own; `flyout` is their menu rows', which must not land back on the bar that opened
 * them. One answer to one question — the flyout's placement was being re-derived inline.
 */
export function tipFor(
  orientation: 'vertical' | 'horizontal',
  of: 'bar' | 'flyout' = 'bar',
): TooltipFactory {
  if (orientation === 'vertical') return TIP_RIGHT
  return of === 'bar' ? TIP_TOP : TIP_BOTTOM
}
