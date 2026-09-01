import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHoverFlyout, type HoverFlyout } from './useHoverFlyout'

/** What a walk of the rows looks like to the hook — only the key matters to it. */
const keyEvent = (key: string) =>
  new KeyboardEvent('keydown', { key }) as unknown as Parameters<
    HoverFlyout['flyoutProps']['onKeyDown']
  >[0]

/** The chord is read by `triggerProps`, so it is PRESSED on a real button rather than called. */
const keyOpened = () => {
  const { result } = renderHook(() => useHoverFlyout(3))
  render(<button {...result.current.triggerProps}>open</button>)
  fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown', altKey: true })
  return result
}

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

  /**
   * Which of the two ways it opened, because they do not deserve the same manners: a menu the
   * pointer wandered into must not take the focus, and one that was asked for must.
   */
  describe('what asked for it', () => {
    it('is not asked for when the pointer merely arrived', () => {
      const { result } = renderHook(() => useHoverFlyout(3))

      act(() => result.current.wrapProps.onPointerEnter())

      expect(result.current.showing).toBe(true)
      expect(result.current.asked).toBe(false)
    })

    it('is asked for when it was opened on purpose', () => {
      const { result } = renderHook(() => useHoverFlyout(3))

      act(() => result.current.open())

      expect(result.current.asked).toBe(true)
    })

    // The pointer leaving and coming back mid-walk would otherwise hand the focus back to the
    // opener, in the middle of the gesture that asked for the menu.
    it('stays asked for while the pointer wanders in and out', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())

      act(() => result.current.wrapProps.onPointerLeave())
      act(() => result.current.wrapProps.onPointerEnter())

      expect(result.current.asked).toBe(true)
    })

    it('lets the pointer close what a click opened', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())

      act(() => result.current.wrapProps.onPointerLeave())
      act(() => vi.advanceTimersByTime(AFTER_GRACE))

      expect(result.current.showing).toBe(false)
    })

    /**
     * Clicked open, then WALKED with the arrows: the walk is a keyboard gesture whatever opened
     * the menu, so from the first arrow the pointer stops being allowed to end it. Without this,
     * moving the mouse off the bar mid-walk closed the rows and threw the focus back.
     */
    it('holds a clicked menu from the first arrow pressed in its rows', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())

      act(() => result.current.flyoutProps.onKeyDown(keyEvent('ArrowDown')))
      act(() => result.current.wrapProps.onPointerLeave())
      act(() => vi.advanceTimersByTime(AFTER_GRACE))

      expect(result.current.showing).toBe(true)
    })

    // A row PRESSED is a choice, not a walk: it must not pin the menu the caller is closing.
    it('is not held by a key that does not walk the rows', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())

      act(() => result.current.flyoutProps.onKeyDown(keyEvent('Enter')))
      act(() => result.current.wrapProps.onPointerLeave())
      act(() => vi.advanceTimersByTime(AFTER_GRACE))

      expect(result.current.showing).toBe(false)
    })

    // The one opening the pointer may not close — see `leave`.
    it('holds a menu the keyboard opened against the pointer leaving', () => {
      const result = keyOpened()

      act(() => result.current.wrapProps.onPointerLeave())
      act(() => vi.advanceTimersByTime(AFTER_GRACE))

      expect(result.current.showing).toBe(true)
    })

    /**
     * Closing by the grace period has to forget the ask as thoroughly as `close` does: left
     * behind, the next menu the pointer merely WANDERS into takes the focus and the caret with
     * it — the very thing telling the two openings apart exists to prevent.
     */
    it('forgets it was asked for once the grace period closed it', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())
      act(() => result.current.wrapProps.onPointerLeave())
      act(() => vi.advanceTimersByTime(AFTER_GRACE))

      act(() => result.current.wrapProps.onPointerEnter())

      expect(result.current.showing).toBe(true)
      expect(result.current.asked).toBe(false)
    })

    it('forgets it was asked for once it is closed', () => {
      const { result } = renderHook(() => useHoverFlyout(3))
      act(() => result.current.open())

      act(() => result.current.close())

      expect(result.current.asked).toBe(false)
    })
  })

  it('closes on demand, for a row that just acted', () => {
    const { result } = renderHook(() => useHoverFlyout(3))

    act(() => result.current.wrapProps.onPointerEnter())
    act(() => result.current.close())
    expect(result.current.showing).toBe(false)
  })
})
