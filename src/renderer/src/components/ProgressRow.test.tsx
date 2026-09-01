import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProgressRow } from './ProgressRow'

const row = (props: Partial<Parameters<typeof ProgressRow>[0]> = {}) =>
  render(
    <ul>
      <ProgressRow label="A001" status="Proxy" {...props} />
    </ul>,
  )

describe('ProgressRow', () => {
  it('names the bar after what it measures, for anyone reading by screen reader', () => {
    row({ ratio: 0.42 })
    // The name carries U+00A0 before the sign — French typography, from the language rather than
    // from the bar. Written as a plain space because `getByLabelText` normalises whitespace; the
    // separator itself is asserted where it is produced, in `helpers/format.test.ts`.
    expect(screen.getByLabelText('A001 42 %')).toBeInTheDocument()
  })

  it('draws no bar for a stage with nothing to measure', () => {
    row()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('offers no cancel button unless there is something to cancel', () => {
    row({ ratio: 0.5 })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('cancels through the caller, which owns what cancelling means', async () => {
    const onClick = vi.fn()
    row({ ratio: 0.5, cancel: { label: 'Interrompre', onClick } })

    await userEvent.click(screen.getByRole('button', { name: /Interrompre/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  /**
   * Some services do not stop a task they have started. The button stays on the row and says
   * why — `aria-disabled` and not `disabled`, because a disabled button dispatches no pointer
   * event in Chromium and the tooltip carrying the reason would never be drawn.
   */
  it('keeps the button and refuses through it, rather than reporting a spend as stopped', async () => {
    const onClick = vi.fn()
    row({
      ratio: 0.5,
      cancel: { label: 'Interrompre', onClick, refusedBecause: 'Tripo ne stoppe rien' },
    })

    const button = screen.getByRole('button', { name: /Interrompre/ })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('data-tooltip-content', 'Tripo ne stoppe rien')

    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows the detail a failure is worth', () => {
    row({ status: 'Échec', detail: <span role="alert">Fichier illisible</span> })
    expect(screen.getByRole('alert')).toHaveTextContent('Fichier illisible')
  })
})
