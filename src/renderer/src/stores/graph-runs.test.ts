import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { GraphState } from '@shared/domain/graph'
import type { Job, JobTarget } from '@shared/domain/job'
import {
  approvalNode,
  graphOf,
  guards,
  modelNode,
  noteNode,
  textNode,
  transformNode,
  wire,
} from '@/engines/graph/graph-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { updateNodeData } from '@/engines/graph/mutations'
import { parseGraph } from '@/engines/graph/serialize'
import { runOf, useGraphRuns } from './graph-runs'
import { installGraph } from './graph-fixtures'
import { job } from './job-fixtures'
import { useGraphs } from './graphs'
import { useJobs } from './jobs'

const DOC = 'doc_graph'

/**
 * A stand-in for the whole job round trip: `submit` puts an entry in the replica, and the test
 * settles it by hand, exactly as a progress event from the main process would.
 */
function installJobs(initial: Partial<Job> = {}): {
  submit: Mock<(target: JobTarget, body: Record<string, unknown>) => Promise<Job>>
  submitted: JobTarget[]
  settle: (id: string, job: Partial<Job>) => void
} {
  const submitted: JobTarget[] = []
  let count = 0

  /**
   * A `vi.fn` taking BOTH arguments, and that is not decoration: written to ignore the body, no
   * test in this file could ever redden on what a graph actually submits — a mutation replacing
   * the body with `{}` left the whole suite green. The pattern `REPRISE-workflows.md` names.
   */
  const submit = vi.fn(async (target: JobTarget, _body: Record<string, unknown>) => {
    count += 1
    submitted.push(target)
    // `initial` is how a suite asks for a job still waiting; the default is one already running.
    const entry = job({ id: `job_${count}`, targetId: target.id, ...initial })
    useJobs.setState(state => ({ jobs: [entry, ...state.jobs] }))
    return entry
  })

  useJobs.setState({ jobs: [], submit, cancel: async () => {} })

  return {
    submit,
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
    [wire('m1', 'prompt', 'text1', 'prompt')],
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

  /** On the body itself, not only on the target: what the wires resolved to has to arrive. */
  it('hands the jobs store the body the graph built', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain('a knight'))

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(jobs.submit).toHaveBeenCalledWith(
      { kind: 'model', id: 'model_a' },
      { prompt: 'a knight' },
    )
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

  /**
   * Submitting is not starting: the job manager holds a submission behind its own concurrency
   * bound and its rate limiter, and a node painted as running on the call would claim work a
   * semaphore may sit on for minutes. This is the one place the two are told apart, since the
   * executor cannot see that queue — it hands over through a port and is told when it moves.
   */
  it('leaves a generator queued until the job manager takes it', async () => {
    const jobs = installJobs({ status: 'queued', progress: 0 })
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    expect(runOf(useGraphRuns.getState(), DOC).nodes['m1']).toEqual({ status: 'queued' })

    jobs.settle('job_1', { status: 'running', progress: 0.4 })
    await vi.waitFor(() =>
      expect(runOf(useGraphRuns.getState(), DOC).nodes['m1']).toEqual({ status: 'running' }),
    )

    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes['m1']).toEqual({ status: 'done' })
  })

  /**
   * The manager polls every two seconds, so a short generation leaves the queue and settles on the
   * SAME event: the wait for a start and the wait for a result answer in one turn. Painting the
   * node as under way on the way past would announce a start for something already over.
   */
  it('never says a job started when it had already finished', async () => {
    const jobs = installJobs({ status: 'queued', progress: 0 })
    installGraph(DOC, chain())
    const seen: string[] = []
    const stop = useGraphRuns.subscribe(state => {
      const run = runOf(state, DOC).nodes['m1']
      if (run && seen.at(-1) !== run.status) seen.push(run.status)
    })

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', progress: 1, assetIds: ['asset_local'] })
    await run
    stop()

    expect(seen).toEqual(['queued', 'done'])
  })

  /**
   * `latest` is the canvas's ONE live region, and a run now opens on as many `queued` reports as
   * the plan has nodes. Moved onto those, it would announce a node the plan's order picked, to say
   * that nothing has started.
   */
  it('names each node once as the run reaches it, and never goes back', async () => {
    const jobs = installJobs({ status: 'queued', progress: 0 })
    installGraph(DOC, chain())
    // Every write, not the end state: `latest` moves on, and a version that followed the whole
    // queue would land on the same last node — innocent-looking from the outside.
    const announced: string[] = []
    const stop = useGraphRuns.subscribe(state => {
      const { latest } = runOf(state, DOC)
      if (latest && announced.at(-1) !== latest) announced.push(latest)
    })

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run
    stop()

    // Not `['text1', 'm1', 'text1', 'm1']`, which is what following the queue gives: the region
    // would name the generator as waiting, go back to the text node, then forward again.
    expect(announced).toEqual(['text1', 'm1'])
  })

  /**
   * A wait on a job that never leaves the queue has no way out of its own: the main process polls
   * an unfinished job with no ceiling, deliberately. The stop is that way out, and NOTHING else in
   * this file can see it missing — every other stop test settles its job first, so the wait answers
   * off the replica and never subscribes at all.
   *
   * Counted through the store's own `subscribe` because a parked wait leaves no other trace: on a
   * graph of twenty generators all held behind the concurrency bound, a stop would leave twenty
   * subscriptions and twenty closures alive for the rest of the session.
   */
  it('lets go of a job still queued when the run is stopped', async () => {
    const jobs = installJobs({ status: 'queued', progress: 0 })
    installGraph(DOC, chain())
    const watching = new Set<() => void>()
    const real = useJobs.subscribe.bind(useJobs)
    const spy = vi.spyOn(useJobs, 'subscribe').mockImplementation(listener => {
      const release = real(listener)
      const wrapped = (): void => {
        watching.delete(wrapped)
        release()
      }
      watching.add(wrapped)
      return wrapped
    })

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    // Two: the wait for the job to leave the queue, and the wait for its result.
    expect(watching.size).toBe(2)

    useGraphRuns.getState().stop(DOC)
    await run
    spy.mockRestore()

    expect(watching.size).toBe(0)
  })

  /**
   * The other half, and it is a REGRESSION this guards against rather than a defect: before the
   * queue existed, pressing Run painted `running` on the first generator at once, so the region
   * said something immediately. A graph whose first node is a generator has nothing else to say
   * until its job leaves the queue — minutes, behind the concurrency bound — and a region silent
   * for that long is a run a screen reader cannot tell from a button that did nothing.
   */
  it('says a run has begun even when its first node only waits', async () => {
    const jobs = installJobs({ status: 'queued', progress: 0 })
    installGraph(DOC, graphOf([modelNode('m1', { prompt: 'a knight' }, 'model_a')], []))

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    const opened = runOf(useGraphRuns.getState(), DOC)
    expect(opened.latest).toBe('m1')
    expect(opened.latest && opened.nodes[opened.latest]).toEqual({ status: 'queued' })

    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run
  })

  /**
   * `nodes` is a record, and a record remembers no order — so it cannot say which node spoke
   * LAST. The canvas needs exactly that, and only the reporter knows it: without `latest` every
   * node had to carry its own live region, twenty of them announcing over each other.
   */
  it('remembers which node spoke last', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    // The generator: its job was taken straight away here, so `running` is the last thing said.
    expect(runOf(useGraphRuns.getState(), DOC).latest).toBe('m1')

    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    const settled = runOf(useGraphRuns.getState(), DOC)

    // The id ALONE, and its state read from `nodes` — the two cannot disagree by construction.
    expect(settled.latest).toBe('m1')
    expect(settled.latest && settled.nodes[settled.latest]).toEqual({ status: 'done' })
  })

  /**
   * `nodes` is wiped when a run starts, for a reason the comment beside it gives: a node left
   * green reads as a result THIS run produced. `latest` is the same fact in another shape — kept,
   * the live region would still be announcing a run whose badges have just been wiped.
   */
  it('drops what the previous run said when a new one starts', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const first = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await first
    expect(runOf(useGraphRuns.getState(), DOC).latest).toBeDefined()

    // Read BEFORE awaiting: the second run reuses the cache and reports again straight away, so
    // what is being pinned here is the wipe at the start, not a state that outlives it.
    const second = useGraphRuns.getState().start(DOC)
    expect(runOf(useGraphRuns.getState(), DOC).latest).toBeUndefined()

    await second
  })

  /**
   * The keyboard is why this lives in the store: the bar greys its button on an empty graph, and
   * a key pressed over the canvas goes nowhere near the bar.
   */
  it('refuses to run a graph that holds no node at all', async () => {
    const jobs = installJobs()
    installGraph(DOC)
    const seen: boolean[] = []
    const unsubscribe = useGraphRuns.subscribe(state => seen.push(runOf(state, DOC).running))

    try {
      await useGraphRuns.getState().start(DOC)
    } finally {
      // A listener left attached would go on filling `seen` for every test after this one.
      unsubscribe()
    }

    expect(jobs.submitted).toEqual([])
    // Not merely false once it is over: the button must never have turned to Stop and back, which
    // is what a run of nothing looks like on screen. Ending false is true either way.
    expect(seen).toEqual([])
  })

  /**
   * The scenario the harness found: a canvas covered in notes is not empty, and greying on node
   * count alone would offer a run that flips the button to Stop and back for nothing.
   */
  it('refuses a graph whose nodes a run would all pass over', async () => {
    const jobs = installJobs()
    installGraph(DOC, graphOf([noteNode('note1', 'à faire'), noteNode('note2', 'et ceci')], []))

    await useGraphRuns.getState().start(DOC)

    expect(jobs.submitted).toEqual([])
    expect(useGraphRuns.getState().runs[DOC]).toBeUndefined()
  })

  /**
   * The other half of that same scenario, and the one a list of node TYPES could not carry: an
   * approval guarding nobody compiles away, so the executor passes over it without a question —
   * the button used to stay lit over a canvas holding nothing else.
   */
  it('refuses a graph whose only approval guards nobody', async () => {
    const jobs = installJobs()
    installGraph(DOC, graphOf([noteNode('note1', 'à faire'), approvalNode('approval1')], []))

    await useGraphRuns.getState().start(DOC)

    expect(jobs.submitted).toEqual([])
    expect(useGraphRuns.getState().runs[DOC]).toBeUndefined()
  })

  /**
   * A text node reports `done` and files its value in the cache, so a run over one is not a run
   * over nothing — which is why it is off the silent list the button reads.
   */
  it('runs a graph of a single text node', async () => {
    installJobs()
    installGraph(DOC, graphOf([textNode('text1')], []))

    await useGraphRuns.getState().start(DOC)

    expect(runOf(useGraphRuns.getState(), DOC).nodes['text1']?.status).toBe('done')
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

  /**
   * The stop has to end the wait, not merely ask the job to end. The main process polls an
   * unfinished job with no ceiling — deliberately — so a run whose job never settles used to sit
   * on that promise for the rest of the session: `running` stayed true, the button stayed on
   * Stop, and every later press of it was refused.
   */
  it('finishes the run even when the cancelled job never settles', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    useJobs.setState({ cancel: vi.fn(async () => {}) })
    useGraphRuns.getState().stop(DOC)
    // Nothing settles `job_1`: the API never answers, which is the case this exists for.
    await run

    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(false)
    // Idle, not failed: the wait was abandoned on the user's word, and painting the node red
    // would blame the API for what the user just did.
    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({ status: 'idle' })
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

  /**
   * The case `withGraphRun` exists for, and the one the first test of it missed by forgetting
   * only AFTER the run: a run still under way kept reporting, and every report went through
   * `runOf(state, id) ?? IDLE` — which put back the entry that had just been dropped, with the
   * local asset ids of a project the user has left.
   */
  it('writes nothing more once its document has been forgotten mid-run', async () => {
    const jobs = installJobs()
    installGraph(DOC, chain())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    useGraphRuns.getState().forget(DOC)
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(useGraphRuns.getState().runs[DOC]).toBeUndefined()
  })

  /**
   * The window `stop` used to miss entirely: a submission crossing the IPC boundary has no job id
   * yet, so there is nothing in `inFlight` to cancel — and the id appears a moment later, on a
   * generation the user has already asked to stop paying for.
   */
  it('cancels a job whose submission came back after the stop', async () => {
    const cancel = vi.fn(async () => {})
    let answer: ((job: Job) => void) | undefined
    useJobs.setState({
      jobs: [],
      cancel,
      submit: async () => {
        const entry = job({ id: 'job_1' })
        useJobs.setState(state => ({ jobs: [entry, ...state.jobs] }))
        return new Promise<Job>(resolve => {
          answer = resolve
        })
      },
    })
    installGraph(DOC, graphOf([modelNode('m1', { prompt: 'a knight' }, 'model_a')], []))

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(answer).toBeDefined())

    useGraphRuns.getState().stop(DOC)
    answer?.(job({ id: 'job_1' }))

    await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith('job_1'))
    useJobs.setState(state => ({
      jobs: state.jobs.map(entry => ({ ...entry, status: 'cancelled' })),
    }))
    await run
  })

  it('leaves a node idle rather than green when the stop landed while it ran', async () => {
    const jobs = installJobs()
    installGraph(DOC, graphOf([modelNode('m1', { prompt: 'a knight' }, 'model_a')], []))

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))

    useGraphRuns.getState().stop(DOC)
    // The job answers anyway — nothing un-submits one already on the wire. What must NOT happen
    // is the node going green and its result entering the cache of a run the user stopped.
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes.m1).toEqual({ status: 'idle' })
    expect(runOf(useGraphRuns.getState(), DOC).cache.size).toBe(0)
  })

  /**
   * Left uncaught, a throw inside the run kept the document `running` for the rest of the
   * session: the button froze on Stop and every later press was refused.
   *
   * The failure is forced rather than fed in, and that is a change: a `.graph` carrying
   * `inputHandles` that is not a list used to be enough, since the plan read it straight. It no
   * longer throws — `inputHandlesOf` guards it — so what is left to test here is the `finally`
   * itself, against a throw of any origin.
   */
  it('stops saying it is running when the run throws', async () => {
    installJobs()
    installGraph(DOC, graphOf([textNode('text1')], []))
    const read = vi.spyOn(useGraphs, 'getState').mockImplementation(() => {
      throw new Error('rejected promise')
    })

    await expect(useGraphRuns.getState().start(DOC)).rejects.toThrow()
    read.mockRestore()

    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(false)
  })

  /**
   * And the shape that used to cause it now runs: `parseGraph` validates the node and not its
   * `data`, so a `.graph` read off disk can carry `inputHandles` as a string, and the plan reads
   * a node with no ports rather than falling over.
   */
  it('runs a graph whose ports a file wrote as something other than a list', async () => {
    installJobs()
    installGraph(
      DOC,
      parseGraph({
        nodes: [
          // A model rather than a text node: the plan has to be reached for it to throw, and a
          // graph of nothing but values is one `start` now declines before planning anything.
          { id: 'model1', type: 'model', position: { x: 0, y: 0 }, data: { inputHandles: 'x' } },
        ],
      }),
    )

    await expect(useGraphRuns.getState().start(DOC)).resolves.toBeUndefined()
    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(false)
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

/**
 * The half of the gate the store owns: it holds the promise the executor is waiting on, and the
 * canvas answers it by node id. Nothing here reaches the API — an approval submits nothing.
 */
describe('answering an approval', () => {
  beforeEach(() => {
    useGraphRuns.setState({ runs: {} })
  })

  /** `m1` generates, `approval1` guards it: the run stops with the node saying `awaiting`. */
  const gated = (): GraphState =>
    graphOf(
      [modelNode('m1', {}, 'model_a'), approvalNode('approval1')],
      [guards('approval1', 'm1')],
    )

  const untilAwaiting = async (): Promise<void> =>
    vi.waitFor(() =>
      expect(runOf(useGraphRuns.getState(), DOC).nodes.approval1).toEqual({ status: 'awaiting' }),
    )

  it('stops on the approval and carries on once it is approved', async () => {
    const jobs = installJobs()
    installGraph(DOC, gated())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await untilAwaiting()

    useGraphRuns.getState().decide(DOC, 'approval1', true)
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes.approval1).toEqual({ status: 'done' })
  })

  it('marks it declined when the answer is no', async () => {
    const jobs = installJobs()
    installGraph(DOC, gated())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await untilAwaiting()

    useGraphRuns.getState().decide(DOC, 'approval1', false)
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes.approval1).toEqual({
      status: 'failed',
      failure: 'declined',
    })
  })

  /** A run left hanging on a question nobody can answer is a document that never stops running. */
  it('lets a stop settle a run waiting on an approval', async () => {
    const jobs = installJobs()
    installGraph(DOC, gated())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await untilAwaiting()

    useGraphRuns.getState().stop(DOC)
    await run

    expect(runOf(useGraphRuns.getState(), DOC).running).toBe(false)
    // Stopped, not declined: nobody said no — the user put the whole run down.
    expect(runOf(useGraphRuns.getState(), DOC).nodes.approval1).toEqual({ status: 'idle' })
  })

  it('does nothing with an answer to a question that is not being asked', () => {
    expect(() => useGraphRuns.getState().decide(DOC, 'approval1', true)).not.toThrow()
  })

  it('ignores a second answer to the same question', async () => {
    const jobs = installJobs()
    installGraph(DOC, gated())

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await untilAwaiting()

    useGraphRuns.getState().decide(DOC, 'approval1', true)
    useGraphRuns.getState().decide(DOC, 'approval1', false)
    await run

    expect(runOf(useGraphRuns.getState(), DOC).nodes.approval1).toEqual({ status: 'done' })
  })
})

/**
 * The one place the executor's transform port meets the boundary. Worth its own suite because the
 * port is the ONLY thing standing between a CEL expression and the SDK, and a store handing the
 * bridge the wrong arguments would still run a graph — it would just never rewrite anything.
 */
describe('the transform port', () => {
  const rewriting = (expression: string): GraphState =>
    graphOf(
      [textNode('text1'), transformNode('transformText1', expression), modelNode('m1')],
      [
        wire('transformText1', 'text', 'text1', 'prompt'),
        wire('m1', 'prompt', 'transformText1', 'text'),
      ],
    )

  it('hands the expression and its variables to the main process, and the answer to the graph', async () => {
    const jobs = installJobs()
    const transform = vi.fn(() => Promise.resolve(['a photo of a cat']))
    installFakeBridge({ workflows: { transform } })
    installGraph(DOC, updateNodeData(rewriting('text1_output'), 'text1', { value: 'a cat' }))

    const run = useGraphRuns.getState().start(DOC)
    await vi.waitFor(() => expect(jobs.submitted).toHaveLength(1))
    jobs.settle('job_1', { status: 'succeeded', assetIds: ['asset_local'] })
    await run

    expect(transform).toHaveBeenCalledWith('text1_output', { text1_output: 'a cat' })
    expect(jobs.submit.mock.calls[0]?.[1]).toEqual({ prompt: 'a photo of a cat' })
  })

  /**
   * No bridge is no evaluation. Said on the node rather than thrown: a window with no preload is
   * every renderer test, and a run must fail on the node that needed it, not as a whole.
   */
  it('fails the node when there is no bridge to evaluate with', async () => {
    installJobs()
    // Taken back down rather than never put up: `installFakeBridge` stubs a global that outlives
    // the test that asked for it, so a suite where any other test installs one has a bridge here.
    vi.unstubAllGlobals()
    installGraph(DOC, rewriting('text1_output'))

    await useGraphRuns.getState().start(DOC)

    expect(runOf(useGraphRuns.getState(), DOC).nodes.transformText1).toEqual({
      status: 'failed',
      failure: 'invalid-expression',
    })
  })
})
