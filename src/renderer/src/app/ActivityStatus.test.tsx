import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { STATUS_BUTTON } from '@/design/styles'
import { useActivity } from '@/stores/activity'
import { ActivityStatus } from './ActivityStatus'

beforeEach(() => {
  useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
})

describe('the journal indicator', () => {
  // Icon-only it was a 12 x 12 target; `STATUS_BUTTON` carries why, and the gauges that fix it.
  it('offers the target the status line shares', () => {
    render(<ActivityStatus />)

    expect(screen.getByRole('button', { name: 'Afficher le journal' })).toHaveClass(STATUS_BUTTON)
  })

  /**
   * Re-clicking the indicator was the only way out, and nobody has that reflex: it reads as a
   * state, not as a close button.
   */
  it('closes on a press beside it', async () => {
    render(
      <>
        <ActivityStatus />
        <button type="button">Ailleurs</button>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le journal' }))
    const panel = screen.getByRole('button', { name: 'Afficher le journal' })
    expect(panel).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Ailleurs' }))

    expect(panel).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape', async () => {
    render(<ActivityStatus />)
    const button = screen.getByRole('button', { name: 'Afficher le journal' })
    await userEvent.click(button)

    await userEvent.keyboard('{Escape}')

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})
