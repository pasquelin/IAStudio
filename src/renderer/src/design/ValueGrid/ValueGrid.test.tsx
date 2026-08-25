import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValueGrid } from './ValueGrid'

const OPTIONS = [
  { value: 0.1, label: '0,1 m' },
  { value: 0.5, label: '0,5 m' },
  { value: 1, label: '1 m' },
]

const setUp = (chosen = 0.5) => {
  const onChoose = vi.fn()
  render(
    <ValueGrid
      options={OPTIONS}
      chosen={chosen}
      columns={3}
      label="Grid step"
      onChoose={onChoose}
    />,
  )
  return { onChoose, user: userEvent.setup() }
}

describe('ValueGrid', () => {
  it('reports the figure that was chosen', async () => {
    const { onChoose, user } = setUp()

    await user.click(screen.getByRole('radio', { name: '1 m' }))

    expect(onChoose).toHaveBeenCalledWith(1)
  })

  /**
   * The chosen cell CARRIES the mark. Said by a tick in a tall column it sat two hundred pixels
   * from the figure it belonged to, and one had to read a whole list to find what was on.
   */
  it('marks the chosen figure on the figure itself', () => {
    setUp()

    expect(screen.getByRole('radio', { name: '0,5 m' })).toHaveClass('bg-accent-soft')
    expect(screen.getByRole('radio', { name: '1 m' })).not.toHaveClass('bg-accent-soft')
  })

  // A value one CHOOSES, never a control one actions: `accent-soft` is what `CLAUDE.md` spends
  // on designated content, and the full accent would say this cell is a button to press.
  it('leaves the full accent alone, which says something else', () => {
    setUp()

    expect(screen.getByRole('radio', { name: '0,5 m' })).not.toHaveClass('bg-accent')
  })

  it('announces one choice among several rather than a list of buttons', () => {
    setUp()

    expect(screen.getByRole('radiogroup', { name: 'Grid step' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '0,5 m' })).toHaveAttribute('aria-checked', 'true')
  })
})
