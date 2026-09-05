import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { WELCOME_VERSION } from '@shared/domain/welcome'
import { installFakeBridge } from '@/services/fakeBridge'
import { WelcomeWindow } from './WelcomeWindow'

vi.mock('./WelcomeCanvas', () => ({
  WelcomeCanvas: () => <canvas aria-hidden="true" />,
}))

describe('WelcomeWindow', () => {
  beforeEach(() => {
    installFakeBridge()
  })

  it('opens on the language screen', () => {
    render(<WelcomeWindow />)
    expect(screen.getByRole('heading', { name: 'Choisissez votre langue' })).toBeInTheDocument()
  })

  /**
   * One mark, and OUTSIDE the rail. It used to open every slide: six copies of the same picture
   * lived in the document at once — `getByRole` refused to answer at all — and the reader watched
   * it slide off and come back on every step.
   */
  it('carries the mark once, above the carousel rather than on each slide', () => {
    render(<WelcomeWindow />)
    const mark = screen.getByRole('img', { name: 'IA Studio' })

    expect(mark.closest('header')).not.toBeNull()
    // The slides are the sections of the rail, and the window's own root carries
    // `overflow-hidden` too — reading that class would pass on a mark inside a slide.
    expect(mark.closest('section')).toBeNull()
  })

  it('advances a section at a time, without a scrollbar', async () => {
    render(<WelcomeWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(screen.getByRole('heading', { name: 'L’apparence' })).toBeInTheDocument()
    expect(document.querySelector('.overflow-hidden')).not.toBeNull()
  })

  it('skips the rest and records that the welcome is done', async () => {
    const write = vi.fn().mockResolvedValue(DEFAULT_SETTINGS)
    installFakeBridge({ settings: { write } })
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})

    render(<WelcomeWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Passer' }))

    expect(write).toHaveBeenCalledWith({
      onboarding: {
        version: WELCOME_VERSION,
        completedAt: expect.any(String),
      },
    })
    expect(close).toHaveBeenCalledOnce()
    close.mockRestore()
  })
})
