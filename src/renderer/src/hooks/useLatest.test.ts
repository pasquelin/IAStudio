import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLatest } from './useLatest'

describe('the current value, read from a listener', () => {
  it('holds what the last render was handed', () => {
    const { result, rerender } = renderHook(value => useLatest(value), { initialProps: 'first' })

    rerender('second')

    expect(result.current.current).toBe('second')
  })

  /**
   * The whole point, and what eleven hand-written copies were for: a listener hung once reads the
   * newest closure without the effect that hung it ever running again. The ref is the identity a
   * dependency list sees, so it must never change.
   */
  it('keeps one ref for the whole life of a component, so nothing re-subscribes', () => {
    const { result, rerender } = renderHook(value => useLatest(value), { initialProps: 1 })
    const held = result.current

    rerender(2)
    rerender(3)

    expect(result.current).toBe(held)
    expect(held.current).toBe(3)
  })

  // An object literal is what half the callers pass — its identity is new on every render, and
  // that is exactly why they could not read it as a dependency.
  it('follows an object rebuilt on every render', () => {
    const { result, rerender } = renderHook(({ a, b }) => useLatest({ a, b }), {
      initialProps: { a: 1, b: 'x' },
    })

    rerender({ a: 2, b: 'y' })

    expect(result.current.current).toEqual({ a: 2, b: 'y' })
  })
})
