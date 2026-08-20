import { useContext } from 'react'
import { ScrollHost } from '@/design/scrollHost'

/** The published scroller, `null` while it mounts, `undefined` where nobody publishes one. */
export function useScrollHost(): HTMLElement | null | undefined {
  return useContext(ScrollHost)
}
