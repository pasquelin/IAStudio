/**
 * Tooltip attribute factory — the equivalent of map3D's `useTip`. Returns the attributes to
 * spread on the button; the accessible name carries the shortcut whether a tooltip exists or
 * not: a button without a tooltip is never a button without an accessible name.
 */
export type TooltipFactory = (label: string, shortcut?: string | false) => Record<string, string>

/** Id of the shared `<Tooltip>`, mounted once at the root. */
export const TOOLTIP_ID = 'sc-tooltip'

export function withShortcut(label: string, shortcut?: string | false): string {
  return shortcut ? `${label} (${shortcut})` : label
}

export function simpleTooltip(place: 'top' | 'right' | 'left' | 'bottom' = 'top'): TooltipFactory {
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
