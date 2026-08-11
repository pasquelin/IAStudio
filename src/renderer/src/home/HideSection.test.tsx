import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type PartialSettings } from '@shared/domain/settings'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { HideSection } from './HideSection'

beforeEach(() => {
  installFakeBridge()
  useSettings.setState(state => ({
    auth: { authenticated: true },
    settings: {
      ...state.settings,
      home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] },
    },
  }))
})

describe('HideSection', () => {
  /**
   * Read off what is SENT to the main process rather than off the store afterwards: the store
   * holds whatever the write answers with, so an assertion on it would be an assertion on the
   * fake bridge's reply — green even if the click sent nothing at all.
   */
  it('takes the band off the page', async () => {
    const write = vi.fn((_partial: PartialSettings) => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })
    render(<HideSection id="explore" />)

    await userEvent.click(screen.getByRole('button', { name: 'Masquer cette section' }))

    await waitFor(() => expect(write).toHaveBeenCalled())
    const sent = write.mock.calls[0]?.[0]?.home?.sections
    expect(sent?.find(section => section.id === 'explore')?.visible).toBe(false)
  })

  // The name says what, the tooltip says what it does — and where what it hid can be found again.
  it('explains what it does instead of reading its label back', () => {
    render(<HideSection id="explore" />)

    expect(screen.getByRole('button', { name: 'Masquer cette section' })).toHaveAttribute(
      'data-tooltip-content',
      `Retire la section de l’accueil${NO_BREAK_SPACE}; une ligne en bas de la page la rétablit`,
    )
  })

  /**
   * A glyph that can only refuse is worse than no glyph: the reader hovers a heading, finds a
   * control, presses it, and nothing happens.
   */
  it('draws nothing at all for a section that cannot be hidden', () => {
    const { container } = render(<HideSection id="spotlight" />)

    expect(container).toBeEmptyDOMElement()
  })
})
