import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageEventPage, UsageReport } from '@shared/domain/usage'
import { installFakeBridge } from '@/services/fake-bridge'
import { UsageWindow } from './UsageWindow'

function report(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    period: 31,
    from: '2026-07-09',
    to: '2026-08-08',
    units: 1240,
    discount: 0,
    jobs: 96,
    daily: [{ date: '2026-08-01', units: 1240 }],
    accounts: [{ accountId: 'acc-1', name: 'Demo app', units: 1240, discount: 0 }],
    models: [{ modelId: 'model_a', name: 'Flux Pro', units: 612, jobs: 48, apiKeyUnits: 100 }],
    actions: [{ label: 'images-generation', count: 48, units: 612 }],
    assets: [{ label: 'image', count: 48 }],
    silent: [],
    price: null,
    ...overrides,
  }
}

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
