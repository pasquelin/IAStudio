import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Job, JobStatus } from '@shared/domain/job'
import { useJobs } from '@/stores/jobs'
import { JobsStatus } from './JobsStatus'

function job(id: string, status: JobStatus, progress: number): Job {
  return {
    id,
    modelId: 'flux-dev',
    label: `Take ${id}`,
    status,
    progress,
    createdAt: '2026-08-07T10:00:00.000Z',
    assetIds: [],
  }
}

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
    expect(screen.getByRole('menu')).toHaveTextContent('Take a')
  })
})
