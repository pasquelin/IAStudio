import { describe, expect, it, vi } from 'vitest'
import { revealWindow, type RevealableWindow } from './reveal'

function fakeWindow(state: { destroyed?: boolean; minimized?: boolean; visible?: boolean } = {}) {
  const restore = vi.fn()
  const show = vi.fn()
  const focus = vi.fn()

  const window: RevealableWindow = {
    isDestroyed: () => state.destroyed ?? false,
    isMinimized: () => state.minimized ?? false,
    isVisible: () => state.visible ?? true,
    restore,
    show,
    focus,
  }

  return { window, restore, show, focus }
}

describe('revealWindow', () => {
  it('focuses a window that is already on screen', () => {
    const { window, restore, show, focus } = fakeWindow()

    revealWindow(window)

    expect(restore).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('restores before focusing, since focus alone is a no-op on a minimised window', () => {
    const { window, restore, focus } = fakeWindow({ minimized: true })

    revealWindow(window)

    expect(restore).toHaveBeenCalledBefore(focus)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('shows a window that was created but never displayed, as during the splash', () => {
    const { window, show, focus } = fakeWindow({ visible: false })

    revealWindow(window)

    expect(show).toHaveBeenCalledBefore(focus)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('shows and restores a minimised window, which macOS and Windows both report as hidden', () => {
    const { window, restore, show, focus } = fakeWindow({ minimized: true, visible: false })

    revealWindow(window)

    expect(show).toHaveBeenCalledBefore(restore)
    expect(restore).toHaveBeenCalledBefore(focus)
    expect(focus).toHaveBeenCalledTimes(1)
  })

  it('leaves a destroyed window alone', () => {
    const { window, restore, show, focus } = fakeWindow({ destroyed: true })

    revealWindow(window)

    expect(restore).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalled()
  })
})
