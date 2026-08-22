import { describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import type { AssetCollector } from '@main/provider/jobManager'
import { createRoutedCollector } from './routedCollector'

const JOB: Job = {
  id: 'job_1',
  targetId: 'sana-600m-1024',
  label: 'Sana 600M',
  status: 'running',
  progress: 1,
  createdAt: '2026-08-22T10:00:00.000Z',
  assetIds: [],
}

const answering = (id: string): AssetCollector =>
  vi.fn(() => Promise.resolve({ ids: [id], workspaces: [] }))

describe('routing a collection to whoever owns the job', () => {
  it('files what this machine produced', async () => {
    const local = answering('local')
    const cloud = answering('cloud')
    const collect = createRoutedCollector({ local, cloud: () => cloud, owns: () => true })

    expect(await collect(JOB, [])).toEqual({ ids: ['local'], workspaces: [] })
    expect(cloud).not.toHaveBeenCalled()
  })

  it('hands the cloud its own outputs, with the ids it answered', async () => {
    const cloud = answering('cloud')
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => cloud,
      owns: () => false,
    })

    await collect(JOB, ['remote_1'])

    expect(cloud).toHaveBeenCalledWith(JOB, ['remote_1'])
  })

  /** A generation made here needs no account, and refusing it for want of one would be absurd. */
  it('collects a local generation with no account held', async () => {
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => null,
      owns: () => true,
    })

    expect(await collect(JOB, [])).toEqual({ ids: ['local'], workspaces: [] })
  })

  /**
   * The account went away between the run and the collection: the outputs exist, nothing here can
   * fetch them, and that is a storage failure rather than a job quietly reported as succeeded.
   */
  it('fails rather than reporting a cloud job with nothing behind it', async () => {
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => null,
      owns: () => false,
    })

    await expect(collect(JOB, ['remote_1'])).rejects.toThrow(/no account/)
  })
})
