import { useEffect } from 'react'
import { isSignature, signatureOf, type Signature } from '@shared/domain/shortcut'
import { IS_MAC } from '@/helpers/platform'

/** Modifiers on their own are not a shortcut; they are what is held while one is pressed. */
const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
])

/**
 * Listens for one chord and answers it — an empty signature meaning the capture was abandoned.
 * Capturing rather than typing a name: nobody knows what `Meta+BracketLeft` is called, and
 * everybody can press it.
 */
export function useChordCapture(onCaptured: (signature: Signature) => void, active: boolean): void {
  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent): void => {
      // Captured on the way down and stopped there, so a shortcut being recorded is not also
      // executed by whatever else is listening — `useShortcuts`, or the browser itself.
      event.preventDefault()
      event.stopPropagation()

      if (MODIFIER_CODES.has(event.code)) return
      // Escape leaves without binding: a capture with no way out is a trap.
      if (event.code === 'Escape') return onCaptured('')

      // Away from macOS the Windows key signs a chord nothing can hold: capturing it would write
      // a binding the settings file refuses on the way back in, and the row would go back by itself.
      const signature = signatureOf(event, IS_MAC)
      if (isSignature(signature)) onCaptured(signature)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [active, onCaptured])
}
