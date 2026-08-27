import { useEffect, useState } from 'react'
import { useLatest } from './useLatest'

/** A flex strip lands its children on fractional pixels; a third of one still reads whole. */
const SLACK = 1

const clippedIn = (strip: HTMLElement, idOfTab: (tab: Element) => string | undefined): string[] => {
  const box = strip.getBoundingClientRect()
  const ids: string[] = []

  for (const tab of Array.from(strip.children)) {
    const rect = tab.getBoundingClientRect()
    if (rect.left >= box.left - SLACK && rect.right <= box.right + SLACK) continue
    const id = idOfTab(tab)
    if (id !== undefined) ids.push(id)
  }

  return ids
}

const sameIds = (one: readonly string[], other: readonly string[]): boolean =>
  one.length === other.length && one.every((id, index) => id === other[index])

/**
 * The tabs a strip has run out of room for, in strip order. EITHER edge outside the strip's own
 * box counts, which is what the eye sees — a half-cut tab is not a tab one can read.
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
      setClipped(previous => (sameIds(previous, next) ? previous : next))
    }

    // Both extents move the answer, and they move apart: the strip's says how much room there
    // is, each tab's how much it takes — a rename changes the second and never the first.
    const sizes = new ResizeObserver(measure)
    const watch = (): void => {
      sizes.disconnect()
      sizes.observe(strip)
      for (const tab of Array.from(strip.children)) sizes.observe(tab)
    }

    const opened = new MutationObserver(() => {
      watch()
      measure()
    })

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
