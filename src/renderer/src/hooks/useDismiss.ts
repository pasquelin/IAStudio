import { useEffect, type RefObject } from 'react'
import { portalAnchorAbove, portalOpenInside } from '@/components/portalAnchors'
import { isComposing } from '@/helpers/composition'

// 🛑 Through the surfaces a press crossed, not the DOM alone — see `portalAnchors.ts`.
function inside(target: Node, surface: HTMLElement | null, opener?: HTMLElement | null): boolean {
  let node: Node | null = target
  while (node) {
    if (surface?.contains(node) || opener?.contains(node)) return true
    node = portalAnchorAbove(node)
  }

  return false
}

/**
 * `pointerdown` in capture, not `click`: a surface that survives until mouseup stays under the
 * pointer while what is behind it has already reacted to the press. `opener` has to count as
 * inside, or the press closes and the click that follows reopens. `undefined` opts out entirely.
 *
 * `onLeave` separates the two reasons a surface closes: pressing outside and `Escape` are the
 * user CLOSING it, while the window losing focus is the user going elsewhere. A surface holding
 * a decision must not take the second for the first — alt-tab would then answer for them.
 */
export function useDismiss(
  onDismiss: (() => void) | undefined,
  surface: RefObject<HTMLElement | null>,
  opener?: HTMLElement | null,
  onLeave: (() => void) | undefined = onDismiss,
): void {
  useEffect(() => {
    if (!onDismiss) return

    const onPointerDown = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!inside(target, surface.current, opener)) onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      // Escape cancels the candidate an input method is composing, and a surface holding a text
      // field would close under it — the assistant does. See `isComposing`.
      if (event.key !== 'Escape' || isComposing(event)) return
      // 🛑 The INNER surface answers it: the pointer was taught to walk the chain and the key was
      // not, so Escape in the journal's own filter menu closed the journal underneath it.
      if (!portalOpenInside(surface.current)) onDismiss()
    }
    const onBlur = (): void => onLeave?.()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onBlur)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
    }
  }, [onDismiss, surface, opener, onLeave])
}
