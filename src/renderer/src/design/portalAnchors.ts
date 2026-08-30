/**
 * Which button raised each PORTALLED surface on screen, so a press or an `Escape` inside one can
 * be told from one outside its opener.
 *
 * 🛑 A flyout and a context menu are both portalled to the document root, so a menu raised from
 * inside another is its DOM SIBLING, not its child — read by containment alone, pressing a filter
 * row of the journal's own menu closed the journal itself, and no filter could ever be ticked.
 *
 * Named for the PORTAL rather than for the flyout, though only one of the two can register today:
 * `ContextMenu` opens at COORDINATES and has no opener element to declare, so a context menu
 * raised from inside a flyout still closes it. Written rather than hidden.
 */
type Held = { anchor: HTMLElement; answersEscape: boolean }

const heldOf = new Map<Element, Held>()

/** Marks a portalled surface: read by the attribute, never by a class. */
export const PORTAL_MARK = 'data-portal-surface'

/**
 * Declares who raised this surface. Returns the way to take it back out of the register.
 *
 * 🛑 `answersEscape` is not a nicety: a flyout with no dismiss of its own — the hover preview of
 * a link field is one — must still stop a PRESS from closing what it sits in, and must NOT stop
 * `Escape`, which it would then answer for nobody.
 */
export function holdPortalAnchor(
  panel: Element,
  anchor: HTMLElement,
  answersEscape: boolean,
): () => void {
  heldOf.set(panel, { anchor, answersEscape })
  return () => heldOf.delete(panel)
}

/** The button that raised the innermost surface holding this node, or nothing outside them all. */
export function portalAnchorAbove(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement
  const panel = element?.closest(`[${PORTAL_MARK}]`)

  return panel ? (heldOf.get(panel)?.anchor ?? null) : null
}

/**
 * Whether a surface raised from inside this one is open — which is what makes `Escape` the
 * INNER one's to answer.
 *
 * 🛑 The other half of the same defect: the pointer was taught to walk the chain, and `Escape`
 * was not, so pressing it in the journal's filter menu closed the journal underneath it.
 */
export function portalOpenInside(surface: HTMLElement | null): boolean {
  if (!surface) return false

  return [...heldOf.values()].some(held => held.answersEscape && surface.contains(held.anchor))
}
