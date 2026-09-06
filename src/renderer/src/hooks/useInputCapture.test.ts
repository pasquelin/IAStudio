// SPDX-License-Identifier: MIT
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useInputCapture } from './useInputCapture'

afterEach(() => vi.restoreAllMocks())

describe('binding a control by pressing it', () => {
  it('takes the next key and stops waiting', () => {
    const taken = vi.fn()
    const { result } = renderHook(() => useInputCapture())

    act(() => result.current.captureKey(taken))
    expect(result.current.capturing).toBe(true)

    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })))

    expect(taken).toHaveBeenCalledWith('KeyJ')
    expect(result.current.capturing).toBe(false)
  })

  /** 🛑 Escape gives up: without it, a capture armed by accident binds the next key typed. */
  it('binds nothing on Escape', () => {
    const taken = vi.fn()
    const { result } = renderHook(() => useInputCapture())

    act(() => result.current.captureKey(taken))
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })))

    expect(taken).not.toHaveBeenCalled()
    expect(result.current.capturing).toBe(false)
  })

  it('binds nothing at all while nothing is armed', () => {
    const taken = vi.fn()
    const { result } = renderHook(() => useInputCapture())

    act(() => result.current.captureKey(taken))
    act(() => result.current.cancel())
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })))

    expect(taken).not.toHaveBeenCalled()
  })

  it('takes the gamepad control pushed past its rest, and ignores a drifting stick', async () => {
    const pad = (leftX: number, south: number): Gamepad =>
      ({
        mapping: 'standard',
        axes: [leftX, 0, 0, 0],
        buttons: [{ value: south }, ...new Array(16).fill({ value: 0 })],
      }) as unknown as Gamepad
    const getGamepads = vi
      .fn<() => (Gamepad | null)[]>()
      .mockReturnValueOnce([pad(0.1, 0)])
      .mockReturnValue([pad(0.1, 1)])
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: getGamepads })
    const taken = vi.fn()
    const { result } = renderHook(() => useInputCapture())

    act(() => result.current.captureGamepadControl(taken))
    await vi.waitFor(() => expect(taken).toHaveBeenCalledWith('south'))

    expect(result.current.capturing).toBe(false)
  })
})
