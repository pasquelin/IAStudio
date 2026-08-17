import { useEffect, useState, type RefObject } from 'react'

/**
 * The element's own width, followed. For a length stored in PIXELS whose default is a share of
 * what is there: half of a band nobody has dragged yet is a number only the DOM knows.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new ResizeObserver(() => setWidth(node.clientWidth))
    observer.observe(node)
    setWidth(node.clientWidth)

    return () => observer.disconnect()
  }, [ref])

  return width
}
