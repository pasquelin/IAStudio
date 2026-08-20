import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UsageEvent, UsageEventPage } from '@shared/domain/usage'
import { installFakeBridge } from '@/services/fakeBridge'
import { UsageJournal } from './UsageJournal'

function page(events: readonly UsageEvent[]): UsageEventPage {
  return { events: [...events], cursors: {}, more: false }
}

function install(events: readonly UsageEvent[]) {
  installFakeBridge({
    provider: { usageEvents: () => Promise.resolve(page(events)) },
  })
}

function event(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    time: '2026-08-09T10:00:00Z',
    action: 'images-generation',
    accountName: 'Demo app',
    units: 12,
    ...overrides,
  }
}

/**
 * The journal named its rows the way the API does — `images-generation` sat in a French table,
 * one column away from a heading that said « Action ».
 */
describe('what the journal calls an event', () => {
  beforeEach(() => install([event()]))

  it('says it in the language of the window', async () => {
    render(<UsageJournal period={31} />)

    expect(await screen.findByText('Génération d’images')).toBeDefined()
    expect(screen.queryByText('images-generation')).toBeNull()
  })

  it('says the events nothing was charged for, too', async () => {
    install([event({ action: 'subscription', units: 0 })])
    render(<UsageJournal period={31} />)

    expect(await screen.findByText('Abonnement')).toBeDefined()
  })

  // Scenario adds actions without notice, and a raw name reads better than a raw key.
  it('shows an action nobody named as the API sent it', async () => {
    install([event({ action: 'holodeck-booked' })])
    render(<UsageJournal period={31} />)

    expect(await screen.findByText('holodeck-booked')).toBeDefined()
  })

  /**
   * The half of the fix a reader actually sees, and nothing asserted it — asked for by review.
   *
   * The suite runs at UTC+9 (`vitest.config.ts`), so a stamp late in the UTC evening is already
   * tomorrow on the wall: a row printing the local hour would read `14/08`, and that is precisely
   * the disagreement with the bar of the 13th this column was changed to end.
   */
  it('prints its hours in UTC, the frame the bars beside it are counted in', async () => {
    install([event({ time: '2026-08-13T23:30:00Z' })])
    render(<UsageJournal period={31} />)

    expect(await screen.findByText('13/08/2026 23:30')).toBeDefined()
    expect(screen.queryByText('14/08/2026 08:30')).toBeNull()
  })

  // And it says so ON the column, because the footnote that explains it renders after the table.
  it('says on the time column which frame those hours are read in', async () => {
    render(<UsageJournal period={31} />)

    const header = await screen.findByText('Date')
    expect(header.getAttribute('data-tooltip-content')).toContain('UTC')
  })
})
