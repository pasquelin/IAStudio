import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useForgettableTimeout } from './useForgettableTimeout'

function Waiting({ onReady, delayMs = 20 }: { onReady: () => void; delayMs?: number }) {
  const timeout = useForgettableTimeout()

  return (
    <button type="button" onClick={() => timeout.after(delayMs, onReady)}>
      wait
    </button>
  )
}

describe('one waiting thing, cancellable', () => {
  it('runs what was scheduled once the delay is out', async () => {
    const ready = vi.fn()
    const { getByRole } = render(<Waiting onReady={ready} />)

    getByRole('button').click()

    await waitFor(() => expect(ready).toHaveBeenCalledTimes(1))
  })

  // Two presses are one waiting thing: the second replaces the first rather than joining it.
  it('drops what was already waiting', async () => {
    const ready = vi.fn()
    const { getByRole } = render(<Waiting onReady={ready} />)

    getByRole('button').click()
    getByRole('button').click()

    await waitFor(() => expect(ready).toHaveBeenCalledTimes(1))
  })

  /** The whole reason it is a hook: a timer outliving its component fires into a dead tree. */
  it('forgets what was waiting when its component goes', async () => {
    const ready = vi.fn()
    const { getByRole, unmount } = render(<Waiting onReady={ready} />)

    getByRole('button').click()
    unmount()
    await new Promise(settle => setTimeout(settle, 60))

    expect(ready).not.toHaveBeenCalled()
  })
})
