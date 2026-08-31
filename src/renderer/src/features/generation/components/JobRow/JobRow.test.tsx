import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Job } from '@shared/domain/job'
import { job as jobOf } from '@/stores/job-fixtures'
import { JobRow } from './JobRow'

/**
 * The shared fixture, already succeeded — which is what this suite is about.
 *
 * Overriding the status to a failing one is not the same suite: the factory then names an `error`
 * code, and `JobDetail` (`JobRow.tsx:18`) draws the failure INSTEAD of the cost — never both.
 */
const job = (overrides: Partial<Job> = {}): Job =>
  jobOf({ id: 'job-1', targetId: 'model-1', label: 'Flux Fast', status: 'succeeded', ...overrides })

/**
 * The same figure was written two ways in the same window: the estimate under the Generate
 * button went through `formatUnits`, the cost on the finished row did not — so a generation
 * priced `1 234` before it ran reported `1234` once it had.
 */
describe('what a finished job says it cost', () => {
  it('groups the thousands, as the estimate under the button already did', () => {
    render(<JobRow job={job({ cost: 1234 })} />)

    expect(screen.getByText('1 234 UC')).toBeDefined()
  })

  // The rule `formatUnits` carries, and the reason it exists: a cheap call rounded to zero
  // would read as "this was free".
  it('keeps the decimals of a call that cost a fraction', () => {
    render(<JobRow job={job({ cost: 0.25 })} />)

    expect(screen.getByText('0,25 UC')).toBeDefined()
  })

  it('says nothing at all when no cost came back', () => {
    render(<JobRow job={job({ cost: undefined })} />)

    expect(screen.queryByText(/UC/)).toBeNull()
  })
})

/**
 * A service that publishes no cancellation: a button reporting a running generation as stopped
 * would have somebody believe they stopped a spend that continues. The row is TOLD — it reads
 * `job.cancellable`, and knows no cloud by name.
 */
describe('a generation nothing can stop', () => {
  it('refuses through the button, and says why', () => {
    render(<JobRow job={job({ cancellable: false, status: 'running' })} />)

    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })

  // Nothing has been spent while it waits in the studio's own queue: that one still stops here.
  it('still cancels one that has not reached the service yet', () => {
    render(<JobRow job={job({ cancellable: false, status: 'queued' })} />)

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled')
  })

  it('leaves a job that carries no such word alone', () => {
    render(<JobRow job={job({ status: 'running' })} />)

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled')
  })
})

/**
 * Decision 5: two clouds, two counters, and nothing added across them. A Tripo credit is not a
 * creative unit and no rate anywhere converts one into the other.
 */
describe('the unit a cost is quoted in', () => {
  it('says credits for a cloud that sells credits', () => {
    render(<JobRow job={job({ cost: 20, costUnit: 'credits' })} />)

    expect(screen.getByText('20 crédits')).toBeDefined()
  })

  it('keeps creative units for a job that carries no unit — every one written before', () => {
    render(<JobRow job={job({ cost: 20 })} />)

    expect(screen.getByText('20 UC')).toBeDefined()
  })
})
