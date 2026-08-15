import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { MenuRow } from './MenuRow'
import { TitleBarSelect } from './TitleBarSelect'

const rows = (close: () => void) => (
  <>
    <MenuRow label="Un" tip={HINT_RIGHT('La première')} onSelect={close} />
    <MenuRow label="Deux" tip={HINT_RIGHT('La seconde')} onSelect={close} />
  </>
)

function mount(overrides: Partial<Parameters<typeof TitleBarSelect>[0]> = {}) {
  return render(
    <TitleBarSelect
      leading={<span data-testid="mark" />}
      label="Été"
      name="Projet : Été"
      hint="Choisir autre chose"
      rowCount={2}
      width="max-w-52"
      rows={rows}
      {...overrides}
    />,
  )
}

const button = (name = 'Projet : Été'): HTMLElement => screen.getByRole('button', { name })

describe('TitleBarSelect', () => {
  it('shows the label under the mark, and names itself for a reader', () => {
    mount()

    expect(button()).toHaveTextContent('Été')
    expect(screen.getByTestId('mark')).toBeInTheDocument()
    expect(button()).toHaveAttribute('data-tooltip-content', 'Choisir autre chose')
  })

  /**
   * The bar is a fixed width shared with the workspace pills, so the label has to give way rather
   * than push. jsdom lays nothing out: the ceiling and the ellipsis are asserted where they are
   * written, and `width` is per caller because a project name is longer than an account's.
   */
  it('caps the label at the width its caller asked for, and truncates inside it', () => {
    mount({ width: 'max-w-44' })

    expect(button()).toHaveClass('max-w-44')
    expect(button().querySelector('.truncate')).toHaveTextContent('Été')
  })

  it('opens its rows on a click, and a row closes what it was chosen from', async () => {
    mount()

    expect(button()).toHaveAttribute('aria-haspopup', 'menu')
    expect(button()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(button())
    expect(button()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Un' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Un' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  /**
   * A menu of one row is not a menu: the button does the one thing left to do instead. Announcing
   * a menu it will never show sends a screen reader looking for rows that are not there.
   */
  it('acts outright rather than opening a menu of one row', async () => {
    const onAct = vi.fn()
    mount({
      rowCount: 1,
      onAct,
      rows: () => <MenuRow label="Un" tip={HINT_RIGHT('La première')} onSelect={() => {}} />,
    })

    expect(button()).not.toHaveAttribute('aria-haspopup')
    expect(button()).not.toHaveAttribute('aria-expanded')

    await userEvent.click(button())
    expect(onAct).toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  // A caller whose row count can never fall to one hands over no `onAct`, and the click must
  // still be harmless rather than throwing on an undefined handler.
  it('does nothing on a lone row when its caller offered no action', async () => {
    mount({ rowCount: 0, rows: () => null })

    await userEvent.click(button())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
