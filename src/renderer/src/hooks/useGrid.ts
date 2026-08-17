import { useEffect, useState } from 'react'
import { columnsIn, type Columns } from '@/design/virtual'

/**
 * How the cards divide the available width. `observe` reports the current size straight away,
 * so no separate first measurement is needed; until it fires, one column is the honest answer
 * rather than a guess.
 *
 * Answers `Columns`, which `Collection` used to redeclare as `Grid`: the same two fields under
 * another name, and a second JSDoc saying the same thing about `columnWidth`.
 */
export function useGrid(
  host: { current: HTMLElement | null },
  cardWidth: number,
  enabled: boolean,
): Columns {
  const [grid, setGrid] = useState<Columns>({ columns: 1, columnWidth: cardWidth })

  useEffect(() => {
    const element = host.current
    // A list-only collection never reads this, and `columnWidth` is a float that changes with
    // every pixel of a splitter drag — the observer would re-render the window twice a frame.
    if (!element || !enabled) return

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width === undefined) return

      const { columns, columnWidth } = columnsIn(width, cardWidth)

      // Same values, same object: a resize that changes neither must not re-render the grid.
      setGrid(current =>
        current.columns === columns && current.columnWidth === columnWidth
          ? current
          : { columns, columnWidth },
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [host, cardWidth, enabled])

  return grid
}
