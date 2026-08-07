import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHoverFlyout } from './useHoverFlyout'

/** Longer than the hook's grace period, whatever it is set to. */
const AFTER_GRACE = 1000

describe('useHoverFlyout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
  it('offers no flyout for a single row', () => {
    const { result } = renderHook(() => useHoverFlyout(1))
    expect(result.current.hasFlyout).toBe(false)
  })

  it('offers one from two rows up', () => {
    const { result } = renderHook(() => useHoverFlyout(2))
    expect(result.current.hasFlyout).toBe(true)
  })

  it('shows on pointer enter and hides once the grace period is over', () => {
    const { result } = renderHook(() => useHoverFlyout(2))

    act(() => result.current.wrapProps.onPointerEnter())
    expect(result.current.showing).toBe(true)

    act(() => result.current.wrapProps.onPointerLeave())
    act(() => void vi.advanceTimersByTime(AFTER_GRACE))
    expect(result.current.showing).toBe(false)
  })

  it('survives the pointer crossing from the button to the rows', () => {
    // The menu is portalled and sits beside the bar, so the pointer is briefly over neither.
    // Closing immediately made the rows unreachable — every single time.
    const { result } = renderHook(() => useHoverFlyout(2))

    act(() => result.current.wrapProps.onPointerEnter())
    act(() => result.current.wrapProps.onPointerLeave())
    act(() => result.current.flyoutProps.onPointerEnter())
    act(() => void vi.advanceTimersByTime(AFTER_GRACE))

    expect(result.current.showing).toBe(true)
  })

  it('closes once the pointer leaves the rows too', () => {
    const { result } = renderHook(() => useHoverFlyout(2))

    act(() => result.current.wrapProps.onPointerEnter())
    act(() => result.current.flyoutProps.onPointerLeave())
    act(() => void vi.advanceTimersByTime(AFTER_GRACE))

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
