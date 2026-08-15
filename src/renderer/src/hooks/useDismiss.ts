import { useEffect, type RefObject } from 'react'

/**
 * The three ways a floating surface goes away without anything being chosen: a press outside it,
 * `Escape`, and the window losing focus. Written once because a surface that only knows one of
 * them is a surface the user has to guess at — and the journal had none, so re-clicking a status
 * indicator was the only way out of it.
 *
 * The third matters more than it looks in a studio: leaving for a reference image and coming back
 * to a panel still hanging over the canvas reads as a bug.
 *
 * `pointerdown`, in capture, rather than `click`: a surface that survives until mouseup stays
 * under the pointer while what is behind it has already reacted to the press.
 *
 * `surface` is a ref because a portalled surface is placed through a callback ref and is not
 * known at render. `opener` is the control that toggles it, and it has to count as inside: left
 * out, the press closes and the click that follows reopens, so the toggle never looks like it
 * closed.
 *
 * Pass `undefined` to opt out entirely — for a surface whose caller closes it another way. The
 * hover flyouts did, until one of them started holding a menu open for the keyboard: with no
 * pointer-out to close it, dismissal is the only way out and they now pass it always.
 */
export function useDismiss(
  onDismiss: (() => void) | undefined,
  surface: RefObject<HTMLElement | null>,
  opener?: HTMLElement | null,
): void {
  useEffect(() => {
    if (!onDismiss) return

    const onPointerDown = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (surface.current?.contains(target) || opener?.contains(target)) return
      onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onDismiss)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onDismiss)
    }
  }, [onDismiss, surface, opener])
}
