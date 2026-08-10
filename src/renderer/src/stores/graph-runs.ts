import { create } from 'zustand'
import { isFinished } from '@shared/domain/job'
import type { GraphNodeRun } from '@/engines/graph/executor'
import type { GraphCache } from '@/engines/graph/plan'
import { graphOf, useGraphs } from './graphs'
import { useJobs, whenSettled } from './jobs'

/** What one graph document is doing, and what it has to show for the runs before this one. */
export type DocumentRun = {
  running: boolean
  /** Only the nodes that have said something — an absent id is idle. */
  nodes: Readonly<Record<string, GraphNodeRun>>
  /**
   * What every finished node produced, by its cache key. Session state, deliberately: it holds
   * LOCAL asset ids, which mean nothing outside the open project — see `GraphCache`.
   */
  cache: GraphCache
}

const IDLE: DocumentRun = { running: false, nodes: {}, cache: new Map() }

type GraphRunsState = {
  runs: Readonly<Record<string, DocumentRun>>
  /** Runs the whole graph. Does nothing while one is already going in that document. */
  start: (documentId: string) => Promise<void>
  /** Stops it: nothing else is submitted, and what is on the wire is cancelled. */
  stop: (documentId: string) => void
  /** Drops what a closed document held — its cache names assets of a project being left. */
  forget: (documentId: string) => void
}

/**
 * The stop of each running document, and the jobs it has out.
 *
 * Beside the store rather than in it: neither is state anything renders, and an `AbortController`
 * put through `set` would make every subscriber recompute for a value none of them read.
 */
const stopping = new Map<string, AbortController>()
const inFlight = new Map<string, Set<string>>()

export const runOf = (state: GraphRunsState, documentId: string): DocumentRun =>
  state.runs[documentId] ?? IDLE

/**
 * What a graph is doing right now, per document — and what it need not do again.
 *
 * The executor is in `engines/` and knows neither React nor the bridge (invariant 4); this is the
 * one place the two meet. Submission goes through `useJobs.submit`, so a graph obeys the job
 * manager's own concurrency bound and rate limiter like every other generation — calling the SDK
 * from here would be the bug `CLAUDE.md` names.
 */
export const useGraphRuns = create<GraphRunsState>()((set, get) => {
  const patch = (documentId: string, change: (held: DocumentRun) => DocumentRun): void =>
    set(state => ({ runs: { ...state.runs, [documentId]: change(runOf(state, documentId)) } }))

  return {
    runs: {},

    start: async documentId => {
      if (runOf(get(), documentId).running) return

      const controller = new AbortController()
      stopping.set(documentId, controller)
      const jobs = new Set<string>()
      inFlight.set(documentId, jobs)

      // Cleared rather than kept: a node left green from the previous run, beside one the graph
      // has since made unreachable, reads as a result this run produced.
      patch(documentId, held => ({ ...held, running: true, nodes: {} }))

      /**
       * Imported here rather than at the top, and `eager-graph.test.ts` is what asks for it:
       * `document-io.ts` reaches this store to drop a closed document's run, and it is in the
       * opening chunk — a static import would put the whole plan engine on the first screen for
       * a graph nobody has opened.
       */
      const { runGraph } = await import('@/engines/graph/executor')

      const result = await runGraph(
        graphOf(useGraphs.getState(), documentId),
        runOf(get(), documentId).cache,
        {
          generate: async (modelId, body) => {
            const job = await useJobs.getState().submit({ kind: 'model', id: modelId }, body)
            // No bridge, or a submission the main process would not take. The node says so; the
            // run carries on with whatever does not depend on it.
            if (!job) throw new Error(`${modelId} was not submitted`)

            jobs.add(job.id)
            const settled = await whenSettled(job.id)
            if (settled?.status !== 'succeeded') throw new Error(`${job.id} did not succeed`)

            return settled.assetIds
          },
          report: (nodeId, run) =>
            patch(documentId, held => ({ ...held, nodes: { ...held.nodes, [nodeId]: run } })),
          signal: controller.signal,
        },
      )

      stopping.delete(documentId)
      inFlight.delete(documentId)

      // A cycle produced nothing, so it must not overwrite what earlier runs had cached.
      patch(documentId, held => ({
        ...held,
        running: false,
        ...(result.ok ? { cache: result.cache } : {}),
      }))
    },

    stop: documentId => {
      stopping.get(documentId)?.abort()

      // Only the ones still going: `cancel` on a job that has already landed would ask the main
      // process to undo a generation that is paid for and whose assets are on disk.
      const { jobs } = useJobs.getState()
      for (const jobId of inFlight.get(documentId) ?? []) {
        const job = jobs.find(candidate => candidate.id === jobId)
        if (job && !isFinished(job.status)) void useJobs.getState().cancel(jobId)
      }
    },

    forget: documentId => {
      stopping.get(documentId)?.abort()
      stopping.delete(documentId)
      inFlight.delete(documentId)

      set(state => {
        const runs = { ...state.runs }
        delete runs[documentId]
        return { runs }
      })
    },
  }
})
