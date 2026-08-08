import { describe, expect, it, vi } from 'vitest'
import { revealWindow, type RevealableWindow } from './reveal'

function fakeWindow(state: { destroyed?: boolean; minimized?: boolean } = {}) {
  const restore = vi.fn()
  const focus = vi.fn()

  const window: RevealableWindow = {
    isDestroyed: () => state.destroyed ?? false,
    isMinimized: () => state.minimized ?? false,
    restore,
    focus,
  }

  return { window, restore, focus }
}

describe('revealWindow', () => {
  it('focuses a window that is already on screen', () => {
    const { window, restore, focus } = fakeWindow()

    revealWindow(window)

    expect(restore).not.toHaveBeenCalled()
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('restores before focusing, since focus alone is a no-op on a minimised window', () => {
    const { window, restore, focus } = fakeWindow({ minimized: true })

    revealWindow(window)

    expect(restore).toHaveBeenCalledBefore(focus)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('leaves a destroyed window alone', () => {
    const { window, restore, focus } = fakeWindow({ destroyed: true })

    revealWindow(window)

    expect(restore).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
  })
})
