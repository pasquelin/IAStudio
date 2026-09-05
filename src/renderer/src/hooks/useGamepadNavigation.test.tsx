// SPDX-License-Identifier: MIT
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyGamepadNavigation, type GamepadNavigationState } from './useGamepadNavigation'

const RESTING: GamepadNavigationState = {
  next: false,
  previous: false,
  confirm: false,
  back: false,
}

describe('gamepad navigation', () => {
  it('moves through focusable controls and confirms on a fresh press', () => {
    const activate = vi.fn()
    render(
      <div>
        <button type="button">First</button>
        <button type="button" onClick={activate}>
          Second
        </button>
      </div>,
    )

    applyGamepadNavigation({ ...RESTING, next: true }, RESTING)
    expect(document.activeElement?.textContent).toBe('First')
    applyGamepadNavigation({ ...RESTING, next: true }, RESTING)
    expect(document.activeElement?.textContent).toBe('Second')
    applyGamepadNavigation({ ...RESTING, confirm: true }, RESTING)
    expect(activate).toHaveBeenCalledOnce()
  })

  it('does not repeat a held direction', () => {
    render(<button type="button">Only</button>)
    const held = { ...RESTING, next: true }

    applyGamepadNavigation(held, held)

    expect(document.activeElement).toBe(document.body)
  })

  it('skips controls hidden by CSS or accessibility state', () => {
    render(
      <div>
        <button type="button" style={{ display: 'none' }}>
          CSS hidden
        </button>
        <div aria-hidden="true">
          <button type="button">ARIA hidden</button>
        </div>
        <button type="button">Visible</button>
      </div>,
    )

    applyGamepadNavigation({ ...RESTING, next: true }, RESTING)

    expect(document.activeElement?.textContent).toBe('Visible')
  })
})
