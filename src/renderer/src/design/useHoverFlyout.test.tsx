import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHoverFlyout } from './useHoverFlyout'

describe('useHoverFlyout', () => {
  it('offers no flyout for a single row', () => {
    const { result } = renderHook(() => useHoverFlyout(1))
    expect(result.current.hasFlyout).toBe(false)
  })

  it('offers one from two rows up', () => {
    const { result } = renderHook(() => useHoverFlyout(2))
    expect(result.current.hasFlyout).toBe(true)
  })

  it('shows on pointer enter and hides on leave', () => {
    const { result } = renderHook(() => useHoverFlyout(2))

    act(() => result.current.wrapProps.onPointerEnter())
    expect(result.current.showing).toBe(true)

    act(() => result.current.wrapProps.onPointerLeave())
    expect(result.current.showing).toBe(false)
  })

  it('never shows when there is nothing to choose', () => {
    const { result } = renderHook(() => useHoverFlyout(1))
    act(() => result.current.wrapProps.onPointerEnter())
    expect(result.current.showing).toBe(false)
  })

  it('closes on demand, for a row that just acted', () => {
    const { result } = renderHook(() => useHoverFlyout(3))

    act(() => result.current.wrapProps.onPointerEnter())
    act(() => result.current.close())
    expect(result.current.showing).toBe(false)
  })
})
