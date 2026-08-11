import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { job } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { Jobs } from './Jobs'

beforeEach(() => {
  useJobs.setState({ jobs: [] })
})

/**
 * One list, two ways in: the status bar's flyout, and a half of the home's right column since it
 * became a panel there. Whatever it says, it says in both.
 */
describe('the jobs list', () => {
  it('draws a row per job', () => {
    useJobs.setState({ jobs: [job({ label: 'FLUX.2' }), job({ id: 'job_2', label: 'Seedream' })] })
    render(<Jobs />)

    expect(screen.getByText('FLUX.2')).toBeInTheDocument()
    expect(screen.getByText('Seedream')).toBeInTheDocument()
  })

  // Never nothing: a panel drawing nothing under a rail icon reads as a fault, and "nothing is
  // running" is an answer. It is also what the band it replaces refused to say.
  it('says that nothing is running rather than drawing nothing', () => {
    render(<Jobs />)

    expect(screen.getByText('Aucune tâche en cours.')).toBeInTheDocument()
  })

  // Finished ones stay for the session: the flyout is where one goes to see what a run cost.
  it('keeps the runs that are over, which the band it replaces dropped', () => {
    useJobs.setState({ jobs: [job({ label: 'FLUX.2', status: 'succeeded' })] })
    render(<Jobs />)

    expect(screen.getByText('FLUX.2')).toBeInTheDocument()
  })
})
