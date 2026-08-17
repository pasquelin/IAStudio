import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useContextMenu } from './useContextMenu'

describe('the pointer a right-click reported', () => {
  const gesture = (x: number, y: number) => ({ preventDefault: vi.fn(), clientX: x, clientY: y })

  // The one contract `TrackHeaders` leans on: it decides BEFORE calling, because this cannot be
  // undone after. Without it the platform's own menu arrives on top of the one being opened.
  it('refuses the platform menu the same gesture would have raised', () => {
    const { result } = renderHook(() => useContextMenu())
    const event = gesture(40, 60)

    act(() => result.current.open(event))

    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('is let go when the menu closes', () => {
    const { result } = renderHook(() => useContextMenu())
    act(() => result.current.open(gesture(40, 60)))

    act(() => result.current.close())

    expect(result.current.at).toBeNull()
  })
})
