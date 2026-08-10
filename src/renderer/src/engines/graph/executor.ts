import type { GraphNode, GraphState } from '@shared/domain/graph'
import { planGraph, type GraphCache, type GraphPlanNode } from './plan'

/** What a node is doing, as the canvas paints it. */
export type GraphRunStatus = 'idle' | 'running' | 'cached' | 'done' | 'failed'

export const GRAPH_RUN_STATUSES: readonly GraphRunStatus[] = [
  'idle',
  'running',
  'cached',
  'done',
  'failed',
]

/**
 * Why a node produced nothing. A code, never a message — the renderer translates it, exactly as
 * it does for a job's own failure (`domain/failure.ts`).
 */
export type GraphRunFailure =
  /** Caught in a loop: the plan refused before anything ran. */
  | 'cycle'
  /** A type this milestone has no execution for — the logic and the loops arrive with step 8. */
  | 'unsupported'
  /** A generator with no model chosen. */
  | 'no-model'
  /** Something it reads produced nothing, so it was never asked to run. */
  | 'blocked'
  /** It ran and the job did not succeed. */
  | 'rejected'

export const GRAPH_RUN_FAILURES: readonly GraphRunFailure[] = [
  'cycle',
  'unsupported',
  'no-model',
  'blocked',
  'rejected',
]

export type GraphNodeRun =
  { status: Exclude<GraphRunStatus, 'failed'> } | { status: 'failed'; failure: GraphRunFailure }

/** What the executor cannot do itself: submit work, say where it is, and be told to stop. */
export type GraphRunPorts = {
  /**
   * Runs one generator and resolves with the LOCAL asset ids it produced — what the collector
   * wrote, not what Scenario answered. They are handed straight to the next node's body: the
   * job manager rewrites them on submission, and a second translator here would be a second
   * truth about the same thing.
   */
  generate: (modelId: string, body: Record<string, unknown>) => Promise<readonly string[]>
  /** Called on every change of state, so the canvas paints while the run is still going. */
  report: (nodeId: string, run: GraphNodeRun) => void
  /** Nodes not started yet are left alone; nothing interrupts a generation already on the wire. */
  signal?: AbortSignal
}

export type GraphRunResult =
  | { ok: false; cycle: readonly string[] }
  /** The cache the next run should start from — what was reused, plus what this run produced. */
  | { ok: true; cache: GraphCache }

/** What a node hands to the ones reading it: the ids it produced, or nothing at all. */
type Outcome = { values: readonly string[] } | null

const EMPTY_CACHE: GraphCache = new Map()

/**
 * Runs a graph: every node, in an order its wires allow, reusing whatever a previous run already
 * produced under the same key.
 *
 * No React, no bridge, no SDK (invariant 4): submission is a port, so the whole thing — waves,
 * cache reuse, a failure stopping what reads it — is testable without a network.
 *
 * There is no wave bookkeeping. The plan is topological, so a node's providers already have a
 * promise by the time its own is made, and awaiting them IS the wave: everything whose inputs are
 * ready starts at once, and the job manager's own semaphore is what bounds the traffic (step 2).
 */
export async function runGraph(
  graph: GraphState,
  cache: GraphCache = EMPTY_CACHE,
  { generate, report, signal }: GraphRunPorts,
): Promise<GraphRunResult> {
  const plan = planGraph(graph, cache)

  if (!plan.ok) {
    // Painted on the nodes at fault rather than thrown: a loop is something the user is still
    // wiring, and the answer to it is the nodes lighting up, not a dialog naming ids.
    for (const id of plan.cycle) report(id, { status: 'failed', failure: 'cycle' })
    return plan
  }

  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  const produced = new Map(cache)
  const settled = new Map<string, Promise<Outcome>>()

  const fail = (id: string, failure: GraphRunFailure): null => {
    report(id, { status: 'failed', failure })
    return null
  }

  const keep = (planned: GraphPlanNode, values: readonly string[]): Outcome => {
    produced.set(planned.hash, values)
    report(planned.id, { status: 'done' })
    return { values }
  }

  const inputsOf = async (
    planned: GraphPlanNode,
  ): Promise<Record<string, readonly string[]> | null> => {
    const resolved: Record<string, readonly string[]> = {}

    for (const [port, source] of Object.entries(planned.inputs)) {
      // Present by construction: a provider comes before its consumer in a topological order, so
      // its promise was made on an earlier turn of the loop below.
      const upstream = await settled.get(source.node)
      if (!upstream) return null
      resolved[port] = upstream.values
    }

    return resolved
  }

  const execute = async (planned: GraphPlanNode, node: GraphNode): Promise<Outcome> => {
    // Read off the cache rather than off `planned.cached`, which says the same thing one step
    // further from the values: two ways of asking one question is how they come to disagree.
    const held = cache.get(planned.hash)
    if (held) {
      report(node.id, { status: 'cached' })
      return { values: held }
    }

    const inputs = await inputsOf(planned)

    // Asked after the inputs, and BEFORE the blocked branch: a stop pressed while a provider was
    // on the wire leaves what it feeds idle, rather than reporting a failure nothing caused.
    if (signal?.aborted) {
      report(node.id, { status: 'idle' })
      return null
    }

    if (!inputs) return fail(node.id, 'blocked')

    if (node.type === 'text') return keep(planned, [asText(node.data.value)])
    if (node.type === 'asset') return keep(planned, asList(node.data.value))
    // A note is drawn on the canvas and compiles to nothing — it has no output to read either.
    if (node.type === 'stickyNote') return { values: [] }
    if (node.type !== 'model') return fail(node.id, 'unsupported')

    const { modelId, form } = node.data
    if (modelId === undefined) return fail(node.id, 'no-model')

    report(node.id, { status: 'running' })

    try {
      return keep(planned, await generate(modelId, bodyOf(form, inputs)))
    } catch {
      // A stop cancels what is on the wire, so the throw that follows is the stop rather than a
      // refusal — painting the node red would blame the API for what the user just did.
      if (signal?.aborted) {
        report(node.id, { status: 'idle' })
        return null
      }

      // The reason belongs to the job, which the jobs panel already shows in full. What the node
      // owes is that it is the one that stopped, so its readers can say why they never ran.
      return fail(node.id, 'rejected')
    }
  }

  for (const planned of plan.order) {
    const node = byId.get(planned.id)
    if (!node) continue
    // Started eagerly, and never rejecting: an outcome is a value here, so nothing in this map
    // can become an unhandled rejection while its consumer is still waiting on a sibling.
    settled.set(planned.id, execute(planned, node))
  }

  await Promise.all(settled.values())
  return { ok: true, cache: produced }
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

const asList = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value]
  if (Array.isArray(value)) return value.filter(held => typeof held === 'string')
  return []
}

/**
 * The body one generator is submitted with: what its form holds, with what its wires feed on top.
 *
 * Blanks are dropped, as `buildBody` drops them before a form is submitted: a node whose form was
 * never opened in the inspector still carries the model's own defaults, and an empty optional enum
 * is answered with a 400.
 *
 * A wired port's own multiplicity is read off the value the form already holds for that key —
 * Scenario publishes no arity on a field, and the model's default is the one place it shows.
 */
function bodyOf(
  form: Readonly<Record<string, unknown>> | undefined,
  inputs: Readonly<Record<string, readonly string[]>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(form ?? {})) {
    if (value !== '' && value !== undefined) body[key] = value
  }

  for (const [key, values] of Object.entries(inputs)) {
    // A provider that produced nothing leaves the key alone rather than writing `undefined` over
    // whatever the form held for it.
    if (values.length === 0) continue
    body[key] = Array.isArray(body[key]) || values.length > 1 ? values : values[0]
  }

  return body
}
