/**
 * The element that actually scrolls an element, or `null` when nothing above it does.
 *
 * A surface that virtualizes against a scroll container it does not own has to find it, and the
 * alternative — threading a ref down from whoever owns the scroll — spreads that ownership
 * across every component in between. The home is the case in point: it holds the only scroll on
 * the screen, deliberately, and a grid three levels down still has to hang off it.
 *
 * `overflow: auto` and `scroll` both scroll; `hidden` does not, whatever its scrollHeight says.
 */
export function scrollParentOf(element: Element | null): HTMLElement | null {
  let parent = element?.parentElement ?? null

  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if (overflowY === 'auto' || overflowY === 'scroll') return parent
    parent = parent.parentElement
  }

  return null
}

/**
 * How far an element sits below the top of what scrolls it — the `scrollMargin` a virtualizer
 * needs when its items are not the first thing in the container.
 *
 * Measured through the viewport rather than by adding up `offsetTop`, which answers relative to
 * the nearest positioned ancestor and would be wrong the moment anything in between is relative.
 */
export function scrollOffsetWithin(element: Element, scroller: HTMLElement): number {
  return element.getBoundingClientRect().top - scroller.getBoundingClientRect().top
}
