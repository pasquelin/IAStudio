import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Job } from '@shared/domain/job'
import { job as jobOf } from '@/stores/job-fixtures'
import { JobRow } from './JobRow'

/** The shared fixture, already finished — which is what this suite is about. */
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
