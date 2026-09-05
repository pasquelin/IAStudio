// SPDX-License-Identifier: MIT
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputSettings } from './InputSettings'

function gamepad(id: string, index: number): Gamepad {
  // The component reads only discovery fields; constructing browser-owned buttons adds no signal.
  return { id, index, connected: true } as Gamepad
}

afterEach(() => vi.restoreAllMocks())

describe('input devices in settings', () => {
  it('lists the keyboard, mouse and every connected gamepad', () => {
    const getGamepads = vi.fn(() => [gamepad('Wireless Controller', 0), null])
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: getGamepads })

    render(<InputSettings />)

    expect(screen.getByText('Clavier')).toBeInTheDocument()
    expect(screen.getByText('Souris')).toBeInTheDocument()
    expect(screen.getByText('Wireless Controller')).toBeInTheDocument()
  })

  it('refreshes the list when a gamepad connects', () => {
    const getGamepads = vi
      .fn<() => (Gamepad | null)[]>()
      .mockReturnValueOnce([])
      .mockReturnValue([gamepad('Arcade Stick', 1)])
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: getGamepads })
    render(<InputSettings />)

    fireEvent(window, new Event('gamepadconnected'))

    expect(screen.getByText('Arcade Stick')).toBeInTheDocument()
  })
})
