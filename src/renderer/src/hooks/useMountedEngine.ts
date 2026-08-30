import { useEffect, useRef, type RefObject } from 'react'
import { useLatest } from './useLatest'

/** All this hook asks of an engine: take a host, take the state back, and go away with the tab. */
export type MountedEngine<S> = {
  mount(host: HTMLElement): void
  dispose(): void
  apply(state: S): void
}

/**
 * Invariant 3 in one place — an engine is REBUILT from its state, never moved, a WebGL context
 * not surviving a detach. The factory is read from a ref rather than depended on: a caller writes
 * a fresh arrow every render, and depending on it would rebuild the viewport at that rate.
 */
export function useMountedEngine<S, T extends MountedEngine<S>>(
  documentId: string,
  create: () => T,
  state: S,
): { host: RefObject<HTMLDivElement | null>; engine: RefObject<T | null> } {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<T | null>(null)
  const latestCreate = useLatest(create)

  useEffect(() => {
    const element = host.current
    if (!element) return

    const renderer = latestCreate.current()
    renderer.mount(element)
    engine.current = renderer

    return () => {
      renderer.dispose()
      engine.current = null
    }
  }, [documentId, latestCreate])

  // The engine holds no truth: every change is pushed back into it.
  useEffect(() => {
    engine.current?.apply(state)
  }, [state])

  return { host, engine }
}
