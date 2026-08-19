import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useExports, type ExportRow } from '@/stores/exports'
import { ExportsStatus } from './ExportsStatus'

const showing = (...rows: ExportRow[]): void => {
  useExports.setState({ running: Object.fromEntries(rows.map(row => [row.id, row])) })
}

beforeEach(() => {
  useExports.setState({ running: {} })
  installFakeBridge()
})

describe('the exports indicator', () => {
  it('says nothing while nothing is being written', () => {
    const { container } = render(<ExportsStatus />)
    expect(container).toBeEmptyDOMElement()
  })

  it('counts what is being written and averages how far along it is', () => {
    showing({ id: 'a', label: 'Coucher', ratio: 0.4 }, { id: 'b', label: 'Bande', ratio: 0.8 })
    render(<ExportsStatus />)

    expect(screen.getByRole('button')).toHaveTextContent('2 transferts')
    // Off `textContent`: the separator is U+00A0, and a matcher that normalises it would accept
    // a hand-written space.
    expect(screen.getByRole('button').textContent).toContain('60 %')
  })

  it('says what opening it does, which its own face never shows', () => {
    showing({ id: 'a', label: 'Coucher', ratio: 0.4 })
    render(<ExportsStatus />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre la liste des transferts en cours',
    )
  })

  /**
   * The half that was missing everywhere but the video render: a bar is half of invariant 6, and
   * an export that cannot be stopped is a studio waiting on a disk it never chose to fill.
   */
  it('stops the one whose button was pressed, and no other', async () => {
    const cancel = vi.fn(() => Promise.resolve(true))
    installFakeBridge({ exports: { cancel } })
    showing({ id: 'a', label: 'Coucher', ratio: 0.4 }, { id: 'b', label: 'Bande', ratio: 0.8 })
    render(<ExportsStatus />)

    await userEvent.click(screen.getByRole('button'))
    const stops = screen.getAllByRole('button', { name: 'Interrompre ce transfert' })
    await userEvent.click(stops[1] as HTMLElement)

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith('b')
  })

  it('names each export by the file it is writing', async () => {
    showing({ id: 'a', label: 'Coucher', ratio: 0.4 })
    render(<ExportsStatus />)

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Coucher')).toBeInTheDocument()
  })
})
