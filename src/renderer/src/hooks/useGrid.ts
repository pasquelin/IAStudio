import { useLayoutEffect, useState } from 'react'
import { columnsIn, type Columns } from '@/design/virtual'

/**
 * How the cards divide the available width.
 *
 * Measured in a LAYOUT effect, and read off the element rather than waited for: a resize observer
 * delivers on the frame after `observe`, which is one paint of cards at their floor width.
 *
 * Answers `Columns`, which `Collection` used to redeclare as `Grid`: the same two fields under
 * another name, and a second JSDoc saying the same thing about `columnWidth`.
 */
export function useGrid(
  host: { current: HTMLElement | null },
  cardWidth: number,
  enabled: boolean,
  maxColumns?: number,
): Columns {
  const [grid, setGrid] = useState<Columns>({ columns: 1, columnWidth: cardWidth })

  useLayoutEffect(() => {
    const element = host.current
    // A list-only collection never reads this.
    if (!element || !enabled) return

    const apply = (width: number): void => {
      const { columns, columnWidth } = columnsIn(width, cardWidth, maxColumns)

      // Same values, same object: a resize that changes neither must not re-render the grid.
      setGrid(current =>
        current.columns === columns && current.columnWidth === columnWidth
          ? current
          : { columns, columnWidth },
      )
    }

    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width !== undefined) apply(width)
    })

    observer.observe(element)
    apply(element.clientWidth)

    return () => observer.disconnect()
  }, [host, cardWidth, enabled, maxColumns])

  return grid
}
