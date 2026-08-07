import { useSyncExternalStore } from 'react'
import { cachedToken, onPaletteChange } from '@/engines/core/palette'

/**
 * A studio token, kept in step with the theme. For the components that need a colour as a
 * value rather than as a class — a swatch handed to a control, a colour passed to a canvas.
 *
 * Reading it once on mount is the mistake this exists to prevent: the component would keep
 * showing the colour of the theme it was mounted under, and it is usually the only thing on
 * screen that never follows.
 */
export function useToken(name: string): string {
  return useSyncExternalStore(onPaletteChange, () => cachedToken(name))
}
