import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_RESCAN, type RescanState } from '@shared/domain/project'
import { installFakeBridge } from '@/services/fakeBridge'
import { RescanBar } from './RescanBar'

/** The main process's announcements, as a test hands them over one at a time. */
function bridgeAt(state: RescanState): { announce: (next: RescanState) => void; stop: () => void } {
  let listener: ((next: RescanState) => void) | null = null
  const stopRescan = vi.fn(() => Promise.resolve())

  installFakeBridge({
    project: {
      rescanState: () => Promise.resolve(state),
      onRescan: callback => {
        listener = callback
        return () => {
          listener = null
        }
      },
      stopRescan,
    },
  })

  return { announce: next => listener?.(next), stop: stopRescan }
}

describe('the row that says the project is being reconciled', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // The ordinary pass is over before it could be painted, and a row that flickered on every
  // return to the window would be the studio talking about itself for nothing.
  it('draws nothing while no pass is running', () => {
    bridgeAt(IDLE_RESCAN)

    render(<RescanBar />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  /**
   * A panel mounted mid-pass has missed every announcement so far. Without the state being asked
   * for at mount, a project of a few files would show nothing at all: the next progress line is
   * the one that never comes.
   */
  it('shows a pass that was already running when it mounted', async () => {
    bridgeAt({ running: true, done: 128, total: 512 })

    render(<RescanBar />)

    expect(await screen.findByText('128 sur 512')).toBeInTheDocument()
  })

  it('follows the counts as they are announced', async () => {
    const { announce } = bridgeAt(IDLE_RESCAN)
    render(<RescanBar />)

    // In `act`: the announcement comes from outside React, and the render it schedules is one
    // the test has to let happen before it looks.
    await act(async () => {
      announce({ running: true, done: 256, total: 512 })
    })

    expect(screen.getByText('256 sur 512')).toBeInTheDocument()
  })

  // Until the pass knows how much it will read, `0 sur 0` says less than no number at all.
  it('says what it is doing before it knows how much there is to do', async () => {
    bridgeAt({ running: true, done: 0, total: 0 })

    render(<RescanBar />)

    await screen.findByRole('button')
    expect(screen.queryByText(/sur/)).not.toBeInTheDocument()
  })

  it('calls the pass off', async () => {
    const user = userEvent.setup()
    const { stop } = bridgeAt({ running: true, done: 1, total: 2 })
    render(<RescanBar />)

    await user.click(await screen.findByRole('button'))

    await waitFor(() => expect(stop).toHaveBeenCalled())
  })
})
