import { useEffect, useState } from 'react'
import { sameOrder } from '@shared/collections'
import { useLatest } from './useLatest'

/** A flex strip lands its children on fractional pixels; a third of one still reads whole. */
const SLACK = 1

const clippedIn = (strip: HTMLElement, idOfTab: (tab: Element) => string | undefined): string[] => {
  // Two integer reads before N+1 boxes, and the answer almost every time. 🛑 Reads FALSE under
  // Dockview's `overflow.mode: 'wrap'`, which turns the strip `overflow: visible`: the chevron
  // would then never appear again, and no guard here would say so.
  if (strip.scrollWidth <= strip.clientWidth) return []

  const box = strip.getBoundingClientRect()
  const ids: string[] = []

  for (const tab of strip.children) {
    const rect = tab.getBoundingClientRect()
    if (rect.left >= box.left - SLACK && rect.right <= box.right + SLACK) continue
    const id = idOfTab(tab)
    if (id !== undefined) ids.push(id)
  }

  return ids
}

/**
 * The tabs a strip has run out of room for. EITHER edge outside its box counts — a half-cut tab
 * is not one anybody reads. Dockview measures this too and publishes only the WRITE half of
 * overflow (`setOverflowExclude`, `refreshOverflow`); a released read event would replace this.
 */
export function useClippedTabs(
  strip: HTMLElement | null,
  idOfTab: (tab: Element) => string | undefined,
): readonly string[] {
  const [clipped, setClipped] = useState<readonly string[]>([])
  const idOf = useLatest(idOfTab)

  useEffect(() => {
    if (!strip) return

    const measure = (): void => {
      const next = clippedIn(strip, idOf.current)
      setClipped(previous => (sameOrder(previous, next) ? previous : next))
    }

    // Both extents move the answer, and they move apart: the strip's says how much room there
    // is, each tab's how much it takes — a rename changes the second and never the first.
    const sizes = new ResizeObserver(measure)
    const watch = (): void => {
      sizes.disconnect()
      sizes.observe(strip)
      for (const tab of strip.children) sizes.observe(tab)
    }

    // `watch` alone: `observe` resets an observation's last-reported size, so re-attaching is
    // itself what asks for the measurement — which is why mounting below needs no `measure` either.
    const opened = new MutationObserver(watch)

    watch()
    opened.observe(strip, { childList: true })
    strip.addEventListener('scroll', measure)

    return () => {
      sizes.disconnect()
      opened.disconnect()
      strip.removeEventListener('scroll', measure)
    }
  }, [idOf, strip])

  return clipped
}
