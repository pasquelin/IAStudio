import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WindowFailure } from './WindowFailure'

describe('WindowFailure', () => {
  // Not a rendering test: it is the last screen a broken window can show, so a missing key
  // here would surface as `errors.windowCrashed` on top of whatever already went wrong.
  it('names the failure in words rather than by its key', () => {
    render(<WindowFailure onRetry={vi.fn()} />)

    expect(screen.getByText('L’application a rencontré une erreur.')).toBeInTheDocument()
  })

  it('offers the way back it was given', async () => {
    const onRetry = vi.fn()
    render(<WindowFailure onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
