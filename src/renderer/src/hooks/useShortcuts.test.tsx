import type { CommandId } from '@shared/domain/command'
import type { MotionId } from '@shared/domain/shortcut'
import { fireEvent, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { publishCommand } from '@/services/command-bus'
import { useHeldCommand, useShortcuts } from './useShortcuts'

/** The hook listens on `window`; the field is here so a test can move focus into one. */
function Fixture({ children }: { children: ReactNode }) {
  return (
    <div>
      <input aria-label="prompt" />
      {children}
    </div>
  )
}

const mount = (
  onCommand: (command: CommandId) => void,
  enabled = true,
  onMotionChange?: (held: Set<MotionId>) => void,
) =>
  renderHook(() => useShortcuts({ scope: 'scene', enabled, onCommand, onMotionChange }), {
    wrapper: Fixture,
  })

describe('useShortcuts', () => {
  it('fires the command bound to the pressed physical key', async () => {
    const onCommand = vi.fn()
    mount(onCommand)
    await userEvent.keyboard('{g}')
    expect(onCommand).toHaveBeenCalledWith('scene.translate')
  })

  it('fires once for a key held down, not once per auto-repeat', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    fireEvent.keyDown(window, { code: 'KeyG' })
    fireEvent.keyDown(window, { code: 'KeyG', repeat: true })
    fireEvent.keyDown(window, { code: 'KeyG', repeat: true })

    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('ignores a key typed into a text field', async () => {
    const onCommand = vi.fn()
    mount(onCommand)
    await userEvent.click(screen.getByLabelText('prompt'))
    await userEvent.keyboard('{g}')
    expect(onCommand).not.toHaveBeenCalled()
  })

  // The platform copies a live selection from anywhere: taking ⌘C would leave the user no way
  // to copy the text they just highlighted.
  it('leaves ⌘C to the text the user has highlighted', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    const selection = window.getSelection()
    selection?.selectAllChildren(screen.getByLabelText('prompt').parentElement as HTMLElement)
    fireEvent.keyDown(window, { code: 'KeyC', metaKey: true })

    expect(onCommand).not.toHaveBeenCalled()

    selection?.removeAllRanges()
    fireEvent.keyDown(window, { code: 'KeyC', metaKey: true })
    expect(onCommand).toHaveBeenCalledWith('scene.copy')
  })

  /**
   * The native menu fires a command, never a key — and on macOS the menu is what hears an
   * accelerator it declared, so the window never sees it. Both doors lead to the surface, or a
   * menu row does nothing: eleven of them did.
   */
  it('runs a command the menu published for its own scope', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    publishCommand('scene.frame')

    expect(onCommand).toHaveBeenCalledWith('scene.frame')
  })

  // Two surfaces are mounted at once — a scene tab and an image tab — and the same command must
  // not run on both. The scope is what tells them apart.
  it('leaves alone a command belonging to another surface', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    publishCommand('canvas.flatten')

    expect(onCommand).not.toHaveBeenCalled()
  })

  // A hidden tab stays mounted: it must not run what the tab in front was handed.
  it('ignores a published command while disabled', () => {
    const onCommand = vi.fn()
    mount(onCommand, false)

    publishCommand('scene.frame')

    expect(onCommand).not.toHaveBeenCalled()
  })

  it('stays silent when disabled', async () => {
    const onCommand = vi.fn()
    mount(onCommand, false)
    await userEvent.keyboard('{g}')
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('tracks a held motion key and releases it', async () => {
    // One `setup()` instance, because a key held down is state: the direct `userEvent.keyboard`
    // starts from a blank keyboard every call and would silently skip the release.
    const user = userEvent.setup()
    const { result } = mount(vi.fn())

    await user.keyboard('{w>}')
    expect([...result.current.heldMotion.current]).toEqual(['forward'])

    await user.keyboard('{/w}')
    expect([...result.current.heldMotion.current]).toEqual([])
  })

  it('drops every held key when the window loses focus', async () => {
    const user = userEvent.setup()
    const { result } = mount(vi.fn())

    await user.keyboard('{w>}')
    window.dispatchEvent(new Event('blur'))
    expect([...result.current.heldMotion.current]).toEqual([])
  })

  it('reports the held set when it changes, so nobody has to poll it every frame', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange)

    await user.keyboard('{w>}')
    expect(onMotionChange).toHaveBeenCalledTimes(1)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual(['forward'])

    await user.keyboard('{/w}')
    expect(onMotionChange).toHaveBeenCalledTimes(2)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual([])
  })

  it('stays quiet while a held key repeats', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange)

    await user.keyboard('{w>}')
    // Dispatched by hand: holding a key makes the platform repeat keydown without any keyup,
    // which `userEvent` will not reproduce — it releases between calls. The set never changes,
    // so neither should the reports.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(onMotionChange).toHaveBeenCalledTimes(1)
  })

  it('reports the release when the window loses focus', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange)

    await user.keyboard('{w>}')
    onMotionChange.mockClear()
    window.dispatchEvent(new Event('blur'))
    expect(onMotionChange).toHaveBeenCalledTimes(1)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual([])
  })

  // A held command is heard by the window, so a surface must not also fire it as a tap — the
  // press would run the command and the hold at once.
  it('leaves a held command to the hook that holds it', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    fireEvent.keyDown(window, { code: 'KeyD', altKey: true })

    expect(onCommand).not.toHaveBeenCalled()
  })
})

describe('useHeldCommand', () => {
  const hold = (onChange: (held: boolean) => void, enabled = true) =>
    renderHook(() => useHeldCommand('app.dictate', enabled, onChange), { wrapper: Fixture })

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
