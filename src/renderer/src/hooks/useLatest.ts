import { useEffect, useRef, type RefObject } from 'react'

/**
 * The current value, readable from a listener that must never be re-subscribed for it.
 *
 * Eleven surfaces had written these four lines, under five different names: a caller passing a
 * fresh arrow on every render is the ordinary case, and reading it as a dependency tears the
 * listener down and hangs it again on each — mid-drag, mid-walk, or sixty times a second while a
 * montage plays. What is subscribed must depend on the QUESTION, never on the answer's identity.
 *
 * Written in an effect and not during the render, which `react-hooks/refs` refuses. No dependency
 * list: assigning a value it already holds costs nothing, and an array is one more thing to get
 * wrong — several of the eleven bundled two callbacks into an object literal, whose identity is
 * new every render anyway.
 *
 * The ref itself is stable, so it belongs in a dependency list rather than being left out of one.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
  })

  return latest
}
