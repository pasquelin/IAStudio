import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { report } from './usage-fixtures'
import { UsageOverview } from './UsageOverview'

describe('the usage overview', () => {
  /**
   * One key writes a quantity of units, holes and all. Glued by hand — `${n} ${t('units')}` — the
   * order of the two halves and what sits between them are decided by the component, which is
   * exactly what a translator has to be able to change.
   */
  it('says a quantity through the sentence, not by gluing a symbol to a number', () => {
    // The per-account row would say the same thing for the default fixture: give it its own.
    render(
      <UsageOverview
        report={report({
          units: 1240,
          accounts: [{ accountId: 'acc-1', name: 'Demo app', units: 7, discount: 0 }],
        })}
      />,
    )

    expect(screen.getByText('1 240 UC')).toBeInTheDocument()
  })

  it('says the discount the same way', () => {
    render(<UsageOverview report={report({ discount: 12 })} />)

    expect(screen.getByText('12 UC')).toBeInTheDocument()
  })

  /**
   * The per-account list writes it too, and it was the fourth site nobody had counted. The
   * FIFTH — the chart's tooltip formatter — is not reachable here: Recharts renders it only
   * under a pointer over a laid-out canvas, and jsdom lays nothing out. Left uncovered on
   * purpose rather than asserted through a mock of the chart.
   */
  it('says it for every account that spent', () => {
    render(
      <UsageOverview
        report={report({
          accounts: [{ accountId: 'acc-2', name: 'Second app', units: 40, discount: 0 }],
        })}
      />,
    )

    expect(screen.getByText('40 UC')).toBeInTheDocument()
  })

  /**
   * The count of jobs is NOT a quantity of units, and it is the one figure here that must stay
   * bare — a number of generations wearing "UC" would read as a second bill.
   */
  it('leaves the count of generations without a unit', () => {
    render(<UsageOverview report={report({ jobs: 96 })} />)

    expect(screen.getByText('96')).toBeInTheDocument()
  })

  // Prices come from a grid the main process may fail to read; units alone are still the answer.
  it('shows money beside the units once a price grid is known', () => {
    render(
      <UsageOverview report={report({ units: 100, price: { perUnit: 0.01, currency: 'EUR' } })} />,
    )

    expect(screen.getByText(/1,00/)).toBeInTheDocument()
  })
})
