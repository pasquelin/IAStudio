import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageEventPage, UsageReport } from '@shared/domain/usage'
import { installFakeBridge } from '@/services/fakeBridge'
import { report } from '../usage-fixtures'
import { UsageWindow } from './UsageWindow'

const EMPTY_EVENTS: UsageEventPage = { events: [], cursors: {}, more: false }

function install(answered: UsageReport, events: UsageEventPage = EMPTY_EVENTS) {
  installFakeBridge({
    scenario: {
      usageReport: () => Promise.resolve(answered),
      usageEvents: () => Promise.resolve(events),
    },
  })
}

describe('UsageWindow', () => {
  beforeEach(() => {
    install(report())
  })

  /**
   * The window renders its own React tree, so the shell's `TooltipHost` never reached it: every
   * tooltip attribute here pointed at an id nothing answered. A closed `<Tooltip>` renders
   * nothing at all, so hovering is the only assertion that says the host is mounted.
   */
  it('mounts the shared tooltip its own tree would otherwise lack', async () => {
    render(<UsageWindow />)

    const refresh = await screen.findByRole('button', { name: 'Actualiser' })
    await userEvent.hover(refresh)

    await waitFor(() => expect(refresh).toHaveAttribute('aria-describedby'))
  })

  /**
   * Never an `aria-label`: one set over a visible label replaces it (WCAG SC 2.5.3), and a
   * button reading "Actualiser" would answer to a sentence nobody can see. The name has to stay
   * the word, the tooltip carries what the word does not say.
   */
  it('explains a labelled button without renaming it', async () => {
    render(<UsageWindow />)

    const refresh = await screen.findByRole('button', { name: 'Actualiser' })
    expect(refresh).toHaveAttribute(
      'data-tooltip-content',
      'Redemande les chiffres au compte — ils ne se rafraîchissent pas seuls',
    )
    expect(refresh).not.toHaveAttribute('aria-label')
  })

  // The pane already carries the sentence; the tab says it before one has to go and look.
  it('tips each section with the sentence its own pane shows', async () => {
    render(<UsageWindow />)

    const tab = await screen.findByRole('button', { name: 'Modèles' })
    expect(tab).toHaveAttribute(
      'data-tooltip-content',
      'Quels modèles ont coûté, et combien de générations chacun a servi.',
    )
  })

  it('shows what was spent over the period', async () => {
    render(<UsageWindow />)
    await screen.findByText('Total consommé')

    // Grouped by the locale, so the separator is whatever French uses, not a space we wrote.
    expect(screen.getAllByText(/1[\s ]?240/).length).toBeGreaterThan(0)
    expect(screen.getByText('96')).toBeInTheDocument()
  })

  // The API publishes no balance; a window of figures that did not say so would imply one.
  it('says the figures are a spend and never a remaining balance', async () => {
    render(<UsageWindow />)

    expect(await screen.findByText(/n’expose pas de solde/)).toBeInTheDocument()
  })

  it('opens on the overview and moves to the models on request', async () => {
    render(<UsageWindow />)
    await screen.findByText('Total consommé')

    await userEvent.click(screen.getByRole('button', { name: 'Modèles' }))

    expect(screen.getByText('Flux Pro')).toBeInTheDocument()
  })

  // Two keys are two invoices; a single total across them matches neither.
  it('warns that a total across accounts matches no invoice', async () => {
    install(
      report({
        accounts: [
          { accountId: 'acc-1', name: 'Demo app', units: 800, discount: 0 },
          { accountId: 'acc-2', name: 'Studio', units: 440, discount: 0 },
        ],
      }),
    )
    render(<UsageWindow />)

    expect(await screen.findByText(/ne correspond à aucune facture/)).toBeInTheDocument()
  })

  it('names a key that refused to answer rather than hiding the gap', async () => {
    install(
      report({ silent: [{ accountId: 'acc-2', name: 'Revoked', failure: 'invalid-credentials' }] }),
    )
    render(<UsageWindow />)

    expect(await screen.findByText(/Revoked/)).toBeInTheDocument()
  })

  /*
   * Two silent accounts are two things true at once, so the language joins them with "et" — not
   * with the bare comma this line carried until the enumeration moved into `formatList`. Measured
   * by a mutation harness: turning this one join into a disjunction reddened nothing before.
   */
  it('names several silent accounts the way the language joins them', async () => {
    install(
      report({
        accounts: [],
        silent: [
          { accountId: 'acc-2', name: 'Revoked', failure: 'invalid-credentials' },
          { accountId: 'acc-3', name: 'Expired', failure: 'invalid-credentials' },
        ],
      }),
    )
    render(<UsageWindow />)

    expect(await screen.findByText(/Revoked et Expired/)).toBeInTheDocument()
  })

  // The grid prices prepaid packs in tiers and says nothing about a subscription's own rate.
  it('calls the euro amount indicative whenever it shows one', async () => {
    install(report({ price: { perUnit: 0.01, currency: 'EUR' } }))
    render(<UsageWindow />)

    expect(await screen.findByText(/Montant indicatif/)).toBeInTheDocument()
  })

  it('shows no euro amount when the price grid did not answer', async () => {
    render(<UsageWindow />)
    await screen.findByText('Total consommé')

    expect(screen.queryByText(/Montant indicatif/)).not.toBeInTheDocument()
  })

  it('reports an empty period as empty rather than as a failure', async () => {
    install(report({ units: 0, jobs: 0, daily: [], models: [], actions: [], assets: [] }))
    render(<UsageWindow />)

    await userEvent.click(await screen.findByRole('button', { name: 'Modèles' }))

    expect(screen.getByText('Aucune activité sur cette période.')).toBeInTheDocument()
  })

  // Zeros because nothing was spent, or because there is no key to ask? A table of zeros reads
  // as the first when it is the second.
  it('says no key is stored rather than showing a table of zeros', async () => {
    install(
      report({ units: 0, jobs: 0, daily: [], accounts: [], models: [], actions: [], assets: [] }),
    )
    render(<UsageWindow />)

    expect(await screen.findByText(/Aucune clé API enregistrée/)).toBeInTheDocument()
    expect(screen.queryByText('Aucune activité sur cette période.')).not.toBeInTheDocument()
  })

  // A key that answered with nothing is not the same as no key at all.
  it('keeps showing the figures when a key answered but another refused', async () => {
    install(
      report({
        accounts: [],
        silent: [{ accountId: 'acc-2', name: 'Revoked', failure: 'invalid-credentials' }],
      }),
    )
    render(<UsageWindow />)

    expect(await screen.findByText(/Revoked/)).toBeInTheDocument()
  })

  // Nobody reads the raw log first, and over 120 days it is the one call heavy enough to hurt.
  it('leaves the activity log unread until its section is opened', async () => {
    const usageEvents = vi.fn(() => Promise.resolve(EMPTY_EVENTS))
    installFakeBridge({
      scenario: { usageReport: () => Promise.resolve(report()), usageEvents },
    })

    render(<UsageWindow />)
    await screen.findByText('Total consommé')
    expect(usageEvents).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Journal' }))

    expect(usageEvents).toHaveBeenCalled()
  })

  it('offers the retry rather than an empty screen when the call is refused', async () => {
    installFakeBridge({
      scenario: {
        usageReport: () => Promise.reject(new Error('unexpected')),
        usageEvents: () => Promise.resolve(EMPTY_EVENTS),
      },
    })
    render(<UsageWindow />)

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
