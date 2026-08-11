import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Job, JobStatus } from '@shared/domain/job'
import { STATUS_BUTTON } from '@/design/styles'
import { job as jobOf } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { JobsStatus } from './JobsStatus'

/**
 * The shared fixture, told the numbered label this suite reads the bar by.
 *
 * `progress` is named on every call, which — per the factory's own rule — opts out of carrying a
 * succeeded job to 1: say it here, as the bar would show it.
 */
const job = (id: string, status: JobStatus, progress: number): Job =>
  jobOf({ id, status, progress, targetId: 'flux-dev', label: `Take ${id}` })

beforeEach(() => {
  useJobs.setState({ jobs: [] })
})

describe('the jobs indicator', () => {
  it('says nothing while nothing is running', () => {
    const { container } = render(<JobsStatus />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays quiet once everything has succeeded', () => {
    useJobs.setState({ jobs: [job('a', 'succeeded', 1)] })
    const { container } = render(<JobsStatus />)
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The face of the button is a count — "2 générations". What pressing it does is nowhere on
   * screen, and the accessible name alone reaches no sighted pointer. Read the content, not the
   * name: the name was already right.
   */
  it('says what opening it does, which its own face never shows', () => {
    useJobs.setState({ jobs: [job('a', 'running', 0.4)] })
    render(<JobsStatus />)

    expect(screen.getByRole('button')).toHaveAttribute(
      'data-tooltip-content',
      'Ouvre la liste des générations, en cours comme terminées',
    )
    expect(screen.getByRole('button')).toHaveAttribute('data-tooltip-place', 'top')
  })

  it('counts what is under way and averages its progress', () => {
    useJobs.setState({ jobs: [job('a', 'running', 0.4), job('b', 'running', 0.8)] })
    render(<JobsStatus />)
    expect(screen.getByRole('button')).toHaveTextContent('2 générations')
    expect(screen.getByRole('button')).toHaveTextContent('60 %')
  })

  it('counts a queued job as under way — it is waiting, not done', () => {
    useJobs.setState({ jobs: [job('a', 'queued', 0)] })
    render(<JobsStatus />)
    expect(screen.getByRole('button')).toHaveTextContent('1 génération')
  })

  // A failure that vanishes with the last running job is a failure nobody reads.
  it('keeps a failure on screen once everything has stopped', () => {
    useJobs.setState({ jobs: [job('a', 'failed', 0.3)] })
    render(<JobsStatus />)
    expect(screen.getByRole('button')).toHaveTextContent('1 échec')
  })

  it('lists the jobs when opened', async () => {
    useJobs.setState({ jobs: [job('a', 'running', 0.4)] })
    render(<JobsStatus />)

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/Take a/)).toBeInTheDocument()
  })

  // Same defect as the journal beside it, seen less often only because the bar is not always up.
  it('closes on a press beside it', async () => {
    useJobs.setState({ jobs: [job('a', 'running', 0.4)] })
    render(
      <>
        <JobsStatus />
        <button type="button">Ailleurs</button>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: /génération/i }))
    expect(screen.getByText(/Take a/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ailleurs' }))

    expect(screen.queryByText(/Take a/)).not.toBeInTheDocument()
  })

  it('offers the target the status line shares', () => {
    useJobs.setState({ jobs: [job('a', 'running', 0.4)] })
    render(<JobsStatus />)

    expect(screen.getByRole('button')).toHaveClass(STATUS_BUTTON)
  })
})
