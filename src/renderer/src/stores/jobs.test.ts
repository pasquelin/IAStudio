import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from './assets'
import { job } from './job-fixtures'
import { useJobs, whenSettled, whenLeftQueue } from './jobs'

describe('jobs store', () => {
  beforeEach(() => {
    useJobs.setState({ jobs: [job({ id: 'job_1' }), job({ id: 'job_2' })] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates a job in place without touching the others', () => {
    const before = useJobs.getState().jobs[1]
    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.6 })

    const [first, second] = useJobs.getState().jobs
    expect(first?.progress).toBe(0.6)
    expect(first?.label).toBe('Flux')
    // Identity matters: replacing the array would restart every animation in the bar.
    expect(second).toBe(before)
  })

  it('ignores progress for a job it does not know', () => {
    useJobs.getState().apply({ id: 'job_unknown', status: 'succeeded', progress: 1 })
    expect(useJobs.getState().jobs).toHaveLength(2)
  })

  it('carries the assets and the error a progress reports', () => {
    useJobs
      .getState()
      .apply({ id: 'job_1', status: 'failed', progress: 0.2, error: 'rate-limited' })

    expect(useJobs.getState().jobs[0]).toMatchObject({
      status: 'failed',
      error: 'rate-limited',
    })
  })

  it('refreshes the asset browser when a job succeeds, and only then', async () => {
    vi.useFakeTimers()
    installFakeBridge()
    const refresh = vi.fn(() => Promise.resolve())
    useAssets.setState({ refresh })

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.9 })
    await vi.runAllTimersAsync()
    expect(refresh).not.toHaveBeenCalled()

    useJobs.getState().apply({ id: 'job_1', status: 'succeeded', progress: 1, assetIds: ['a_1'] })
    await vi.runAllTimersAsync()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useJobs.getState().jobs[0]?.assetIds).toEqual(['a_1'])
    vi.useRealTimers()
  })

  /**
   * `apply` can only merge into a job it already holds, so a job the main process picked up from
   * a previous session would never appear and one that stepped aside would spin for ever. The
   * whole list is the only thing that can say either.
   */
  it('takes the list the main process announces when its composition changes', async () => {
    const listeners: ((jobs: Job[]) => void)[] = []
    const stopProgress = vi.fn()
    const stopChanges = vi.fn()
    installFakeBridge({
      scenario: {
        onProgress: () => stopProgress,
        onJobsChanged: callback => {
          listeners.push(callback)
          return stopChanges
        },
      },
    })

    const stop = await useJobs.getState().connect()
    for (const announce of listeners) announce([job({ id: 'job_resumed', label: 'Veo' })])

    expect(useJobs.getState().jobs).toEqual([expect.objectContaining({ id: 'job_resumed' })])

    stop()
    // Both go with the same call, or a closed window keeps receiving events into a dead store.
    expect(stopProgress).toHaveBeenCalledOnce()
    expect(stopChanges).toHaveBeenCalledOnce()
  })

  it('puts a freshly submitted job at the top of the list', async () => {
    installFakeBridge({
      scenario: {
        generate: () => Promise.resolve(job({ id: 'job_new', status: 'queued', progress: 0 })),
      },
    })

    await useJobs.getState().submit({ kind: 'model', id: 'model_flux' }, { prompt: 'a rock' })
    expect(useJobs.getState().jobs[0]?.id).toBe('job_new')
  })
})

describe('waiting on a job', () => {
  beforeEach(() => {
    useJobs.setState({ jobs: [job({ id: 'job_1' })] })
  })

  it('answers straight away for one that has already stopped', async () => {
    useJobs.setState({ jobs: [job({ id: 'job_1', status: 'succeeded', assetIds: ['asset_1'] })] })

    await expect(whenSettled('job_1', null)).resolves.toMatchObject({ assetIds: ['asset_1'] })
  })

  it('waits for the progress that stops it, and ignores the ones that do not', async () => {
    const settled = whenSettled('job_1', null)

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.5 })
    useJobs.getState().apply({ id: 'job_1', status: 'failed', progress: 0.5, error: 'server' })

    await expect(settled).resolves.toMatchObject({ status: 'failed' })
  })

  /**
   * The way out that does not depend on the job. The main process polls an unfinished job with
   * no ceiling — on purpose, since it is paid for — so a caller who has given up has nothing else
   * to wait for, and would hold its frame for the rest of the session.
   */
  it('gives up when the caller aborts, and says it found nothing', async () => {
    const controller = new AbortController()
    const settled = whenSettled('job_1', controller.signal)

    controller.abort()

    await expect(settled).resolves.toBeNull()
  })

  it('answers nothing at once when the caller had already given up', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(whenSettled('job_1', controller.signal)).resolves.toBeNull()
  })

  /** A generation already paid for and finished is a result, whatever the caller pressed after. */
  it('hands back a job that had already succeeded, even to a caller who aborted', async () => {
    useJobs.setState({ jobs: [job({ id: 'job_1', status: 'succeeded', assetIds: ['asset_1'] })] })
    const controller = new AbortController()
    controller.abort()

    await expect(whenSettled('job_1', controller.signal)).resolves.toMatchObject({
      assetIds: ['asset_1'],
    })
  })

  /**
   * An abort after the answer must not reopen a settled promise, nor leave a listener behind.
   * The listener is what the assertion is on: resolving twice is a no-op a promise hides, so the
   * only thing that can go wrong here is one held on a signal that outlives the wait.
   */
  it('stops listening to the abort once the job has settled', async () => {
    const controller = new AbortController()
    const released = vi.spyOn(controller.signal, 'removeEventListener')
    const settled = whenSettled('job_1', controller.signal)

    useJobs.getState().apply({ id: 'job_1', status: 'succeeded', progress: 1, assetIds: ['a1'] })
    await expect(settled).resolves.toMatchObject({ status: 'succeeded' })

    expect(released).toHaveBeenCalledWith('abort', expect.any(Function))

    controller.abort()
    await expect(settled).resolves.toMatchObject({ status: 'succeeded' })
  })

  it('answers nothing for a job the replica no longer holds, rather than waiting for ever', async () => {
    const settled = whenSettled('job_1', null)
    // What a project closed under a running job leaves behind: the main process drops the entry
    // and announces the list without it. Waited on, this one would never come back.
    useJobs.setState({ jobs: [] })

    await expect(settled).resolves.toBeNull()
  })
})

describe('waiting for a job to leave the queue', () => {
  beforeEach(() => {
    useJobs.setState({ jobs: [job({ id: 'job_1', status: 'queued', progress: 0 })] })
  })

  it('waits while the job is still queued, and answers when it starts', async () => {
    const started = whenLeftQueue('job_1', null)

    useJobs.getState().apply({ id: 'job_1', status: 'running', progress: 0.1 })

    await expect(started).resolves.toMatchObject({ status: 'running' })
  })

  /**
   * A job that finished between two polls did leave the queue, and the graph node reading this
   * has to stop saying it is waiting. Held out for a `running` nobody observed, the node would
   * read as queued for the whole generation and then jump to done.
   */
  it('answers for a job that went straight to its result', async () => {
    const started = whenLeftQueue('job_1', null)

    useJobs.getState().apply({ id: 'job_1', status: 'succeeded', progress: 1, assetIds: ['a1'] })

    await expect(started).resolves.toMatchObject({ status: 'succeeded' })
  })

  it('answers straight away for one that had already started', async () => {
    useJobs.setState({ jobs: [job({ id: 'job_1', status: 'running' })] })

    await expect(whenLeftQueue('job_1', null)).resolves.toMatchObject({ status: 'running' })
  })

  /**
   * The only test here whose job is still WAITING when the signal is raised, and the only one that
   * makes this wait subscribe at all — the three above answer off the replica and never listen.
   *
   * It was written, deleted as a duplicate of `whenSettled`'s own, and put back by the review that
   * named what the deletion cost: a graph of twenty generators all held behind the concurrency
   * bound, stopped by the user, leaves twenty subscriptions and twenty closures alive for the rest
   * of the session — the very leak the required `signal` exists to prevent. Nothing else would
   * redden if a caller passed `null` here.
   */
  it('gives up when the caller aborts, and says it found nothing', async () => {
    const controller = new AbortController()
    const started = whenLeftQueue('job_1', controller.signal)

    controller.abort()

    await expect(started).resolves.toBeNull()
  })
})
