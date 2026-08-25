import { describe, expect, it, vi } from 'vitest'
import { mdiMagnet } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { ValueGrid } from '../ValueGrid/ValueGrid'
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
      valueName="Grid step"
      rowCount={2}
      rows={close => (
        <ValueGrid
          options={[
            { value: 0.5, label: '0.5' },
            { value: 1, label: '1' },
          ]}
          chosen={0.5}
          columns={2}
          label="Grid step"
          onChoose={value => {
            onSelect(String(value))
            close()
          }}
        />
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
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  // The two halves stay separate HERE: what a choice does beyond being reported is the caller's,
  // and the snap bar spends it on arming the toggle. This component must not do it behind them.
  it('reports a choice without toggling on its own', async () => {
    const { onToggle, onSelect, user } = setUp()

    await user.hover(screen.getByRole('button', { name: /Grid step/ }))
    await user.click(screen.getByRole('radio', { name: '1' }))

    expect(onSelect).toHaveBeenCalledWith('1')
    expect(onToggle).not.toHaveBeenCalled()
  })

  // The tool column opens its own menus on hover; a second bar over the same viewport opening
  // only on click was two manners for one gesture.
  it('opens under the pointer, as every other menu of the studio does', async () => {
    const { user } = setUp()

    await user.hover(screen.getByRole('button', { name: /Grid step/ }))

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })

  // The pointer opens it on the way in, so the click that follows is the one that PUTS IT AWAY —
  // which is what a toggle means here. Without it the menu could only be dismissed by leaving.
  it('closes on a click of the half the pointer opened', async () => {
    const { user } = setUp()
    const value = screen.getByRole('button', { name: /Grid step/ })

    await user.hover(value)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()

    await user.click(value)
    expect(screen.queryByRole('radiogroup')).toBeNull()
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

  /**
   * Dragged, the speed went « 4 m/s » to « 10 m/s » and the button grew a character: every
   * control after it shuffled sideways, and the whole bar flickered under the pointer.
   */
  it('holds the room its longest reading needs, whatever it is showing', () => {
    setUp({ value: '4 m/s', widest: '20 m/s' })

    expect(screen.getByRole('button', { name: /Grid step/ })).toHaveTextContent('20 m/s')
  })

  /**
   * The name carries what is READ — the figure on screen — and what the control IS. Composed
   * here rather than by five callers, and it must not pick up the copy held open behind it: a
   * reader hearing the widest value beside the real one would be told two speeds.
   */
  it('names itself by the figure on screen, never by the copy behind it', () => {
    setUp({ value: '4 m/s', widest: '20 m/s' })

    expect(screen.getByRole('button', { name: /Grid step/ })).toHaveAccessibleName(
      '4 m/s — Grid step',
    )
  })

  it('wears the icon on its value half when it has no toggle', () => {
    setUp({ onToggle: undefined, value: '4 m/s', valueName: 'Camera speed' })

    expect(screen.queryByRole('button', { name: /Grid snap/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Camera speed/ })).toBeInTheDocument()
  })
})
