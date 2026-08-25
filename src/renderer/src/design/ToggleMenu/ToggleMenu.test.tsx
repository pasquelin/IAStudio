import { describe, expect, it, vi } from 'vitest'
import { mdiMagnet } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { MenuRow } from '../MenuRow'
import { ToggleMenu } from './ToggleMenu'

const setUp = (props: Partial<Parameters<typeof ToggleMenu>[0]> = {}) => {
  const onToggle = vi.fn()
  const onSelect = vi.fn()

  render(
    <ToggleMenu
      icon={mdiMagnet}
      label="Grid snap"
      description="Toggles it. The menu picks the step."
      tooltip={TIP_BOTTOM}
      pressed={false}
      onToggle={onToggle}
      value="0.5"
      valueLabel="Grid step"
      rowCount={2}
      rows={close => (
        <>
          <MenuRow
            label="0.5"
            checked
            tick="one-of"
            tip={{}}
            onSelect={() => {
              onSelect('0.5')
              close()
            }}
          />
          <MenuRow
            label="1"
            checked={false}
            tick="one-of"
            tip={{}}
            onSelect={() => {
              onSelect('1')
              close()
            }}
          />
        </>
      )}
      {...props}
    />,
  )

  return { onToggle, onSelect, user: userEvent.setup() }
}

describe('ToggleMenu', () => {
  it('toggles from the icon half without opening the menu', async () => {
    const { onToggle, user } = setUp()

    await user.click(screen.getByRole('button', { name: /Grid snap/ }))

    expect(onToggle).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  // The two halves stay separate HERE: what a choice does beyond being reported is the caller's,
  // and the snap bar spends it on arming the toggle. This component must not do it behind them.
  it('reports a choice without toggling on its own', async () => {
    const { onToggle, onSelect, user } = setUp()

    await user.click(screen.getByRole('button', { name: /Grid step/ }))
    await user.click(screen.getByRole('menuitemradio', { name: '1' }))

    expect(onSelect).toHaveBeenCalledWith('1')
    expect(onToggle).not.toHaveBeenCalled()
  })

  // Hovering opens `MenuButton`, and it must not open this one: the bar sits over the viewport,
  // and a menu the pointer merely crossed would cover the very scene it is about to change.
  it('stays shut under the pointer', async () => {
    const { user } = setUp()

    await user.hover(screen.getByRole('button', { name: /Grid step/ }))

    expect(screen.queryByRole('menu')).toBeNull()
  })

  /**
   * An armed snap is something one ACTIONS, and `CLAUDE.md` spends the full accent on exactly
   * that. Painted by `active` alone it took `bg-elevated` — the colour the HOVER already uses —
   * so the bar said the same thing about the control under the pointer and the one in hand.
   * `ToolbarTool` carries the same pair for the same reason.
   */
  it('paints an armed toggle in the full accent, not in the hover colour', () => {
    setUp({ pressed: true })

    expect(screen.getByRole('button', { name: /Grid snap/ })).toHaveClass('bg-accent')
  })

  it('leaves a toggle that is off out of the accent', () => {
    setUp()

    expect(screen.getByRole('button', { name: /Grid snap/ })).not.toHaveClass('bg-accent')
  })

  it('wears the icon on its value half when it has no toggle', () => {
    setUp({ onToggle: undefined, value: '4 m/s', valueLabel: 'Camera speed' })

    expect(screen.queryByRole('button', { name: /Grid snap/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Camera speed/ })).toBeInTheDocument()
  })
})
