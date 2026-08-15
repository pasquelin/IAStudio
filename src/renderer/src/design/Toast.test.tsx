import { mdiAlertOutline } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toast, ToastStack } from './Toast'

const renderToast = (onDismiss = vi.fn()) =>
  render(
    <ToastStack>
      <Toast icon={mdiAlertOutline} dismissLabel="Ignorer" onDismiss={onDismiss}>
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

  it('dismisses on the button that says so', async () => {
    const onDismiss = vi.fn()
    renderToast(onDismiss)

    await userEvent.click(screen.getByRole('button', { name: 'Ignorer' }))

    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
