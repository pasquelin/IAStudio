import { useEffect, type RefObject } from 'react'
import { isComposing } from '@/helpers/composition'

/**
 * `pointerdown` in capture, not `click`: a surface that survives until mouseup stays under the
 * pointer while what is behind it has already reacted to the press. `opener` has to count as
 * inside, or the press closes and the click that follows reopens. `undefined` opts out entirely.
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
      // Escape cancels the candidate an input method is composing, and a surface holding a text
      // field would close under it — the assistant does. See `isComposing`.
      if (event.key === 'Escape' && !isComposing(event)) onDismiss()
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
