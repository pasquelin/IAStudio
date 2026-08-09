import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UsageReport } from '@shared/domain/usage'
import { UsageActivities } from './UsageActivities'

function report(overrides: Partial<UsageReport>): UsageReport {
  return {
    period: 31,
    from: '2026-08-01',
    to: '2026-08-09',
    units: 0,
    discount: 0,
    jobs: 0,
    daily: [],
    accounts: [],
    silent: [],
    models: [],
    actions: [],
    assets: [],
    price: null,
    ...overrides,
  }
}

/**
 * The table showed the names the API uses — `images-generation` in a French window, and `video`
 * a few pixels under a `Vidéo` the bundle had known all along.
 */
describe('the names the usage report counts under', () => {
  it('says an action in the language of the window', () => {
    render(
      <UsageActivities
        report={report({ actions: [{ label: 'images-generation', count: 48, units: 612 }] })}
      />,
    )

    expect(screen.getByText('Génération d’images')).toBeDefined()
    expect(screen.queryByText('images-generation')).toBeNull()
  })

  it('says an asset kind too, rather than leaving the API word beside a translated one', () => {
    render(<UsageActivities report={report({ assets: [{ label: 'video', count: 4 }] })} />)

    expect(screen.getByText('Vidéo')).toBeDefined()
  })

  // Scenario adds usage names without notice, and a raw name reads better than a raw key.
  it('shows a name nobody has translated as the API sent it', () => {
    render(
      <UsageActivities report={report({ actions: [{ label: 'holodeck', count: 1, units: 2 }] })} />,
    )

    expect(screen.getByText('holodeck')).toBeDefined()
  })
})
