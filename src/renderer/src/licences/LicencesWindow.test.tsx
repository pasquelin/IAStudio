import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fake-bridge'
import { LicencesWindow } from './LicencesWindow'

// Unfolding a licence puts its WHOLE text in the DOM — that is the point of the panel — and
// `userEvent` re-checks pointability against all of it on every click. Under a loaded run the
// two-click case went past the default budget, which reads as a broken panel rather than a slow
// test. Raised rather than trimmed: what makes it slow is what it exists to prove.
vi.setConfig({ testTimeout: 20_000 })

describe('LicencesWindow', () => {
  beforeEach(() => {
    installFakeBridge()
  })

  it('names every component the studio ships', () => {
    render(<LicencesWindow />)

    expect(screen.getByRole('button', { name: /FFmpeg/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^three\b/ })).toBeInTheDocument()
  })

  // A notice that needs a working network to be read is not a notice: the whole text is here.
  it('unfolds the full text of a licence, not a link to it', async () => {
    render(<LicencesWindow />)
    const entry = screen.getByRole('button', { name: /^three\b/ })

    expect(entry).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(entry)

    expect(entry).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Copyright/)).toBeInTheDocument()
  })

  it('shows one at a time, so the list stays readable', async () => {
    render(<LicencesWindow />)

    await userEvent.click(screen.getByRole('button', { name: /^three\b/ }))
    await userEvent.click(screen.getByRole('button', { name: /FFmpeg/ }))

    expect(screen.getByRole('button', { name: /^three\b/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  // FFmpeg is the one whose licence asks for more than attribution: whoever receives the binary
  // must be able to reach the sources it was built from.
  it('offers the sources of the copyleft component', async () => {
    render(<LicencesWindow />)
    await userEvent.click(screen.getByRole('button', { name: /FFmpeg/ }))

    expect(screen.getByText(/ffmpeg\.org\/download/)).toBeInTheDocument()
  })
})
