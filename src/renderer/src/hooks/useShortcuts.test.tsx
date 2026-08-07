import { fireEvent, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CommandId, MotionId } from '@shared/domain/shortcut'
import { useShortcuts } from './useShortcuts'

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
})
