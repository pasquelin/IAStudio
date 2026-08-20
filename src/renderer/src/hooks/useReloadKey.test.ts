import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useReloadKey } from './useReloadKey'

describe('a key that changes when it is asked to', () => {
  it('answers a different key on every ask', () => {
    const { result } = renderHook(() => useReloadKey())
    const first = result.current[0]

    act(() => result.current[1]())
    const second = result.current[0]
    act(() => result.current[1]())

    expect(second).not.toBe(first)
    expect(result.current[0]).not.toBe(second)
  })

  /**
   * The ask goes into dependency lists and into `useCallback` brackets at four call sites: a fresh
   * identity would re-run the very reads it exists to trigger, once per render.
   */
  it('hands back the same ask every render', () => {
    const { result, rerender } = renderHook(() => useReloadKey())
    const ask = result.current[1]

    rerender()
    act(() => ask())

    expect(result.current[1]).toBe(ask)
  })
})
