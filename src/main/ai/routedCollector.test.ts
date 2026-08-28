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

function answering(id: string): AssetCollector {
  return vi.fn(() => Promise.resolve({ ids: [id], workspaces: [] }))
}

describe('routing a collection to whoever owns the job', () => {
  it('files what this machine produced', async () => {
    const local = answering('local')
    const cloud = answering('cloud')
    const collect = createRoutedCollector({
      local,
      cloud: () => cloud,
      owns: () => true,
      wroteText: () => false,
    })

    expect(await collect(JOB, [], null)).toEqual({ ids: ['local'], workspaces: [] })
    expect(cloud).not.toHaveBeenCalled()
  })

  it("asks ownership of the runner's job id, not the studio's", async () => {
    const owns = vi.fn((id: string) => id === 'local_abc')
    const local = answering('local')
    const cloud = answering('cloud')
    const collect = createRoutedCollector({
      local,
      cloud: () => cloud,
      owns,
      wroteText: () => false,
    })

    await collect({ ...JOB, remoteId: 'local_abc' }, [], null)

    expect(owns).toHaveBeenCalledWith('local_abc')
    expect(local).toHaveBeenCalled()
    expect(cloud).not.toHaveBeenCalled()
  })

  it('hands the cloud its own outputs, with the ids it answered', async () => {
    const cloud = answering('cloud')
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => cloud,
      owns: () => false,
      wroteText: () => false,
    })

    await collect(JOB, ['remote_1'], null)

    expect(cloud).toHaveBeenCalledWith(JOB, ['remote_1'], null)
  })

  it('collects a local generation with no account held', async () => {
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => null,
      owns: () => true,
      wroteText: () => false,
    })

    expect(await collect(JOB, [], null)).toEqual({ ids: ['local'], workspaces: [] })
  })

  /** 🛑 A script writer files NOTHING: what it produced is text on the job, and it lands in an
   * editor. Routed to either collector, an empty batch would still have gone through a shelf. */
  it('files nothing for a job that wrote a script', async () => {
    const local = answering('local')
    const cloud = answering('cloud')
    const collect = createRoutedCollector({
      local,
      cloud: () => cloud,
      owns: () => true,
      wroteText: () => true,
    })

    expect(await collect(JOB, [], null)).toEqual({ ids: [], workspaces: [] })
    expect(local).not.toHaveBeenCalled()
    expect(cloud).not.toHaveBeenCalled()
  })

  it('fails rather than reporting a cloud job with nothing behind it', async () => {
    const collect = createRoutedCollector({
      local: answering('local'),
      cloud: () => null,
      owns: () => false,
      wroteText: () => false,
    })

    await expect(collect(JOB, ['remote_1'], null)).rejects.toThrow(/no account/)
  })
})
