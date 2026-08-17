import { fireEvent, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ShortcutsFixture } from './shortcuts-fixtures'
import { useHeldCommand } from './useHeldCommand'

describe('useHeldCommand', () => {
  const hold = (onChange: (held: boolean) => void, enabled = true) =>
    renderHook(() => useHeldCommand('app.dictate', enabled, onChange), {
      wrapper: ShortcutsFixture,
    })

  const press = (init: KeyboardEventInit = {}) =>
    fireEvent.keyDown(window, { code: 'KeyD', altKey: true, ...init })

  const release = () => fireEvent.keyUp(window, { code: 'KeyD', altKey: true })

  it('reports the press and the release', () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    release()

    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  /**
   * The order a hand actually uses: the little finger leaves ⌥ before the index leaves D. Read
   * as a signature, that release is `KeyD` — matching nothing — and the one after it `AltLeft`,
   * matching nothing either. The microphone stayed open, and because the hook still believed
   * the key was down, every later press was ignored: dictation was dead until the window lost
   * the focus.
   */
  it('releases when the modifier is let go before the key', () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    fireEvent.keyUp(window, { code: 'AltLeft', key: 'Alt', altKey: false })

    expect(onChange.mock.calls).toEqual([[true], [false]])
  })

  it('takes the next press after a release in that order', () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    fireEvent.keyUp(window, { code: 'AltLeft', key: 'Alt', altKey: false })
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd', altKey: false })
    press()

    expect(onChange.mock.calls).toEqual([[true], [false], [true]])
  })

  it('reports the press once, not once per auto-repeat', () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    press({ repeat: true })
    press({ repeat: true })

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // The whole point of dictation is to speak into the field one is already in, so the guard
  // every other shortcut obeys is lifted for a command that declares `held`.
  it('fires while the focus sits in a text field', async () => {
    const onChange = vi.fn()
    hold(onChange)

    await userEvent.click(screen.getByLabelText('prompt'))
    press()

    expect(onChange).toHaveBeenCalledWith(true)
  })

  // Pressed outside a field and released inside one, the release still has to land — otherwise
  // the microphone stays open with nothing holding it.
  it('releases on a key up wherever the focus has moved', async () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    await userEvent.click(screen.getByLabelText('prompt'))
    release()

    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('releases when the window loses focus, which never delivers a key up', () => {
    const onChange = vi.fn()
    hold(onChange)

    press()
    window.dispatchEvent(new Event('blur'))

    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('releases when it stops being enabled mid-press', () => {
    const onChange = vi.fn()
    const { unmount } = hold(onChange)

    press()
    unmount()

    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('stays silent while disabled', () => {
    const onChange = vi.fn()
    hold(onChange, false)

    press()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores another key', () => {
    const onChange = vi.fn()
    hold(onChange)

    fireEvent.keyDown(window, { code: 'KeyG', altKey: true })

    expect(onChange).not.toHaveBeenCalled()
  })
})
