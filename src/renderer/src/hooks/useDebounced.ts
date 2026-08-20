import { useEffect, useState } from 'react'

/**
 * How long the typing must stop before the word travels. One value for the two panels that search
 * the API as one types: they wait the same, and two constants would drift into two behaviours.
 */
export const SEARCH_DELAY_MS = 250

/**
 * Holds a value back until it stops changing. Every keystroke in a search field would
 * otherwise be a request across IPC and out to the API, and the answers would race each other
 * back — the last one to arrive winning rather than the last one asked.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
