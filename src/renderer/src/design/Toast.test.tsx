import { mdiAlertOutline } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast, ToastStack } from './Toast'

const renderToast = (onDismiss = vi.fn()) =>
  render(
    <ToastStack>
      <Toast
        icon={mdiAlertOutline}
        tone="warning"
        dismissLabel="Ignorer"
        dismissHint="Marque l'avertissement comme lu"
        onDismiss={onDismiss}
      >
        <span>Le compte a changé</span>
      </Toast>
    </ToastStack>,
  )

describe('Toast', () => {
  /**
   * The column is eighty wide and a single notice fills a fraction of it. Before the pair was
   * written once, the assistant's own stack took the pointer over all of it — clicks meant for
   * the document below landed on nothing at all.
   */
  it('lets the pointer through the stack and takes it back on the notice', () => {
    const { container } = renderToast()

    const stack = container.firstElementChild
    expect(stack).toHaveClass('pointer-events-none')
    expect(stack?.firstElementChild).toHaveClass('pointer-events-auto')
  })

  // The hint explains rather than repeating the visible name — and it is the one field of the
  // contract that only one of the two hosts passes, so nothing else would notice it going missing.
  it('dismisses on the button that says so, and hands its hint to the tooltip', async () => {
    const onDismiss = vi.fn()
    renderToast(onDismiss)
    const button = screen.getByRole('button', { name: 'Ignorer' })

    expect(button).toHaveAttribute('data-tooltip-content', "Marque l'avertissement comme lu")

    await userEvent.click(button)

    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
