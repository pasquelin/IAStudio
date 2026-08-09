import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { TooltipHost } from './TooltipHost'

function Anchored() {
  return (
    <>
      <span role="img" tabIndex={0} {...TIP_BOTTOM('Something to explain')} />
      <TooltipHost />
    </>
  )
}

/**
 * Read the anchor rather than the bubble: the content node is in the document long before the
 * delay elapses, so its presence says nothing about whether the tooltip is open. The library
 * points `aria-describedby` at the tooltip for exactly as long as it shows.
 */
describe('TooltipHost', () => {
  it('opens on focus, so a tooltip is not a pointer-only channel', async () => {
    render(<Anchored />)

    await userEvent.tab()

    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('aria-describedby'))
  })

  // Where a tooltip is the only thing that shows a sentence, it is content rather than
  // decoration — and content has to go away without the pointer having to move.
  it('closes on Escape, without asking the focus to go anywhere', async () => {
    render(<Anchored />)
    const anchor = screen.getByRole('img')
    await userEvent.tab()
    await waitFor(() => expect(anchor).toHaveAttribute('aria-describedby'))

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(anchor).not.toHaveAttribute('aria-describedby'))
    expect(anchor).toHaveFocus()
  })
})
