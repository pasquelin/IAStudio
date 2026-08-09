import { useEffect, useState } from 'react'

export type OnScreen = {
  /** Put on whatever stands in for the content until it is worth reading. */
  ref: (node: HTMLElement | null) => void
  /** True once the element has come into view, and true from then on. */
  seen: boolean
}

/**
 * Whether an element has ever been on screen — for work that is not worth doing until it is.
 *
 * Latched rather than live: a band that unloaded itself on the way past would read again on the
 * way back, which costs more than never having deferred it.
 *
 * The home is what this is for. It fires five round trips as it mounts, two of them for bands
 * that sit below the fold on any window — the reader has not seen them, and on a rate-limited
 * key they are two of the requests that make the ones above fail.
 */
export function useOnScreen(): OnScreen {
  // The element is state and not a ref: an effect has to run again once there is one to watch,
  // and writing a ref is not something React re-renders on.
  const [element, setElement] = useState<HTMLElement | null>(null)
  // Settled before the first render rather than corrected after one: no observer is not "never
  // seen" — a window that cannot say what is on screen has to be taken at its word that
  // everything is, and deferring for ever is worse than not deferring at all.
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (seen || !element) return

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setSeen(true)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element, seen])

  return { ref: setElement, seen }
}
