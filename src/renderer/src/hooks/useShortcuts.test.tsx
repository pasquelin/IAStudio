import { renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CommandId } from '@shared/domain/shortcut'
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

const mount = (onCommand: (command: CommandId) => void, enabled = true) =>
  renderHook(() => useShortcuts({ enabled, onCommand }), { wrapper: Fixture })

describe('useShortcuts', () => {
  it('fires the command bound to the pressed physical key', async () => {
    const onCommand = vi.fn()
    mount(onCommand)
    await userEvent.keyboard('{g}')
    expect(onCommand).toHaveBeenCalledWith('scene.translate')
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
})
