import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphState } from '@shared/domain/graph'
import type { Job, JobTarget } from '@shared/domain/job'
import { graphOf, modelNode, textNode, wire } from '@/engines/graph/graph-fixtures'
import { updateNodeData } from '@/engines/graph/mutations'
import { runOf, useGraphRuns } from './graph-runs'
import { installGraph } from './graph-fixtures'
import { useGraphs } from './graphs'
import { useJobs } from './jobs'

const DOC = 'doc_graph'

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    kind: 'model',
    targetId: 'model_flux',
    label: 'Flux',
    status: 'running',
    progress: 0,
    createdAt: '2026-08-10T10:00:00.000Z',
    assetIds: [],
    ...overrides,
  }
}

/**
 * A stand-in for the whole job round trip: `submit` puts an entry in the replica, and the test
 * settles it by hand, exactly as a progress event from the main process would.
 */
function installJobs(): {
  submitted: JobTarget[]
  settle: (id: string, job: Partial<Job>) => void
} {
  const submitted: JobTarget[] = []
  let count = 0

  useJobs.setState({
    jobs: [],
    submit: async target => {
      count += 1
      submitted.push(target)
      const entry = job(`job_${count}`, { targetId: target.id })
      useJobs.setState(state => ({ jobs: [entry, ...state.jobs] }))
      return entry
    },
    cancel: async () => {},
  })

  return {
    submitted,
    settle: (id, change) =>
      useJobs.setState(state => ({
        jobs: state.jobs.map(entry => (entry.id === id ? { ...entry, ...change } : entry)),
      })),
  }
}

/** A text node feeding one generator: the smallest graph that proves a body was built. */
function chain(prompt = 'a knight'): GraphState {
  const graph = graphOf(
    [textNode('text1'), modelNode('m1', {}, 'model_a')],
    [wire('m1', 'prompt', 'text1', 'output')],
  )

  return updateNodeData(graph, 'text1', { value: prompt })
}

describe('running a graph document', () => {
  beforeEach(() => {
    useGraphRuns.setState({ runs: {} })
  })

  it('submits through the jobs store, never around it', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(jobs.submitted[0]).toEqual({ kind: 'model', id: 'model_a' })
  })

  it('says the graph is running until every node has settled', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(true)

    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(false)
    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({ status: 'done' })
  })

  it('refuses a second run of the same document while the first is going', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    await useGraphRuns.getState().start(DOC)

    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(jobs.submitted).toHaveLength(1)
  })

  it('marks a node failed when its job does not succeed', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'failed', error: 'rate-limited' })
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({
      status: 'failed',
      failure: 'rejected',
    })
  })

  it('does not run again what nothing changed about', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const first = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await first

    await useGraphRuns.getState().start(DOC)

    expect(jobs.submitted).toHaveLength(1)
    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({ status: 'cached' })
  })

  it('runs again what the user has since edited', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const first = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await first

    useGraphs.setState(state => ({
      states: { ...state.states, [DOC]: chain('a dragon') },
    }))

    const second = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(2))
    jobs.settle('job_2', { status: 'succeeded', assetIds: ['asset_other'] })
    await second

    expect(jobs.submitted).toHaveLength(2)
  })

  it('marks a node failed when nothing came back from the submission at all', async () => {
    installJobs()
    // What a window with no bridge answers, and what a submission the main process refuses to
    // take answers too. Left unguarded, the run would wait on a job id that does not exist.
    useJobs.setState({ submit: async () => null })
    installGraph(DOC, chain())

    await useGraphRuns.getState().start(DOC)

    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({
      status: 'failed',
      failure: 'rejected',
    })
  })

  /** A cycle produced nothing, so it must not overwrite what the runs before it had cached. */
  it('keeps the cache of the previous run when the graph turns out to be a loop', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    const cached = runOf(useGraphRuns.getState(), DOC).cache
    useGraphs.setState(state => ({
      states: {
        ...state.states,
        [DOC]: graphOf(
          [modelNode('a', {}, 'model_a'), modelNode('b', {}, 'model_b')],
          [wire('a', 'prompt', 'b', 'image'), wire('b', 'prompt', 'a', 'image')],
        ),
      },
    }))

    await useGraphRuns.getState().start(DOC)

    expect(runOf(useGraphRuns.getState(), DOC).cache).toBe(cached)
    expect(runOf(useGraphRuns.getState(), DOC).nodes.a).toEqual({
      status: 'failed',
      failure: 'cycle',
    })
  })

  it('clears what the previous run said before the next one starts', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const first = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'failed' })
    await first

    // The graph is untouched, so the second run reaches the same node — what must not survive is
    // the failure the first run painted while the second is still on its way there.
    const second = useGraphRuns.getState().start(DOC)
    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toBeUndefined()

    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(2))
    jobs.settle('job_2', { status: 'succeeded', assetIds: ['asset_local'] })
    await second
  })
})

describe('stopping and forgetting a run', () => {
  beforeEach(() => {
    useGraphRuns.setState({ runs: {} })
  })

  it('cancels the job still on the wire and submits nothing more', async () => {
    const jobs = installJobs()
    const cancel = vi.fn(async () => {})
    installGraph(
      DOC,
      graphOf(
        [modelNode('m1', {}, 'model_a'), modelNode('m2', {}, 'model_b')],
        [wire('m2', 'prompt', 'm1', 'image')],
      ),
    )

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    useJobs.setState({ cancel })
    useGraphRuns.getState().stop(DOC)
    expect(cancel).toHaveBeenCalledWith('job_1')

    jobs.settle('job_1', { status: 'cancelled' })
    await run

    expect(jobs.submitted).toHaveLength(1)
    expect(runOf(useGraphRuns.getState(), DOC).nodes.m2).toEqual({ status: 'idle' })
  })

  it('leaves a job that already landed alone', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    const cancel = vi.fn(async () => {})
    useJobs.setState({ cancel })
    useGraphRuns.getState().stop(DOC)

    expect(cancel).not.toHaveBeenCalled()
  })

  /** A project closed under a running job takes its entry out of the replica with it. */
  it('asks nothing of a job the replica no longer holds', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    const cancel = vi.fn(async () => {})
    useJobs.setState({ jobs: [], cancel })
    useGraphRuns.getState().stop(DOC)

    expect(cancel).not.toHaveBeenCalled()
    await run
  })

  it('drops the cache of a document being closed', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    useGraphRuns.getState().forget(DOC)
    expect(useGraphRuns.getState().runs[DOC]).toBeUndefined()

    // Nothing is cached any more, so the very same graph is submitted afresh.
    const again = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(2))
    jobs.settle('job_2', { status: 'succeeded', assetIds: ['asset_local'] })
    await again
  })
})
