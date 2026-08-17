import { useEffect } from 'react'

/**
 * Calls back as the end of a virtualized surface nears, so the next page is asked for before
 * the reader sees the bottom.
 *
 * An empty surface is NOT the end of one: asking for more with nothing on screen loops until the
 * source runs dry, and only the caller knows whether an empty answer is worth another request.
 *
 * `Collection` and `Masonry` had this rule twice, down to the comment. The unit differs — rows
 * there, items here — so the caller states it, and states it by name: three bare numbers swap
 * silently, and the swap would show up as a paging bug rather than as a type error.
 */
export function useReachEnd(
  { last, count, ahead }: { last: number; count: number; ahead: number },
  onReachEnd?: () => void,
): void {
  const nearEnd = count > 0 && last >= count - ahead

  useEffect(() => {
    if (nearEnd) onReachEnd?.()
  }, [nearEnd, count, onReachEnd])
}
