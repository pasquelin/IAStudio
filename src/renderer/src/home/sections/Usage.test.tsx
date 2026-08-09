import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageReport } from '@shared/domain/usage'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { settleHome } from '../home-fixtures'
import { Usage } from './Usage'

function report(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    period: 31,
    from: '2026-07-09',
    to: '2026-08-09',
    units: 1240,
    discount: 0,
    jobs: 37,
    daily: [],
    accounts: [],
    models: [
      { modelId: 'model_a', name: 'FLUX.2', units: 900, jobs: 20, apiKeyUnits: 0 },
      { modelId: 'model_b', name: 'Seedream', units: 340, jobs: 17, apiKeyUnits: 0 },
    ],
    actions: [],
    assets: [],
    silent: [],
    price: null,
    ...overrides,
  }
}

function install(value: UsageReport | null) {
  const usageReport = vi.fn(() =>
    value ? Promise.resolve(value) : Promise.reject(new Error('missing')),
  )
  installFakeBridge({ scenario: { usageReport } })
  return { usageReport }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
})

describe('the usage band', () => {
  it('says what went, over the period the usage window itself opens on', async () => {
    // The two must not disagree: a home saying one figure and the window another is worse than
    // the home saying nothing.
    const { usageReport } = install(report())
    render(<Usage />)

    expect(await screen.findByText(/1 240 unités sur 31 jours/)).toBeInTheDocument()
    expect(usageReport).toHaveBeenCalledWith(31)
  })

  it('names what the units went on, dearest first', async () => {
    install(report())
    render(<Usage />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(screen.getByText('Seedream')).toBeInTheDocument()
  })

  it('draws nothing at all before the report has landed', () => {
    // An initial state is not an answer, and "0 units" is a claim this band has not verified.
    install(report())
    const { container } = render(<Usage />)

    // Nothing a reader can perceive. Not an empty container: a hidden marker stays behind so
    // the band knows when it has been scrolled to, which is what defers its request.
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('stays silent when the key is refused, like every other band', async () => {
    // Waited on the call, then on a tick: the band is empty at first render too, so asserting
    // emptiness straight away would pass before the refusal had even been read.
    const { usageReport } = install(null)
    const { container } = render(<Usage />)

    await vi.waitFor(() => expect(usageReport).toHaveBeenCalled())
    await act(async () => {
      await new Promise(done => setTimeout(done, 0))
    })
    // Nothing a reader can perceive. Not an empty container: a hidden marker stays behind so
    // the band knows when it has been scrolled to, which is what defers its request.
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('reports a period nobody spent anything in, rather than hiding', async () => {
    // Zero is an answer once it has been read — and this account really is at zero.
    install(report({ units: 0, jobs: 0, models: [] }))
    render(<Usage />)

    expect(await screen.findByText(/0 unités sur 31 jours/)).toBeInTheDocument()
  })
})
