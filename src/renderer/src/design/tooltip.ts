/**
 * Tooltip attribute factory — the equivalent of map3D's `useTip`. Returns the attributes to
 * spread on the button; the accessible name carries the shortcut whether a tooltip exists or
 * not: a button without a tooltip is never a button without an accessible name.
 */
export type TooltipFactory = (label: string, shortcut?: string | false) => Record<string, string>

/** Id of the shared `<Tooltip>`, mounted once at the root. */
export const TOOLTIP_ID = 'sc-tooltip'

export type TooltipPlace = 'top' | 'right' | 'left' | 'bottom'

export function withShortcut(label: string, shortcut?: string | false): string {
  return shortcut ? `${label} (${shortcut})` : label
}

function makeTooltip(place: TooltipPlace): TooltipFactory {
  return (label, shortcut) => {
    const text = withShortcut(label, shortcut)
    return {
      'aria-label': text,
      'data-tooltip-id': TOOLTIP_ID,
      'data-tooltip-content': text,
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
export const TIP_BOTTOM = makeTooltip('bottom')
