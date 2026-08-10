import type {
  GraphNode,
  GraphNodeRun,
  GraphRunFailure,
  GraphState,
  GraphTransformVariables,
} from '@shared/domain/graph'
import { CONDITIONAL_PORT } from '@shared/domain/graph'
import { readString } from '@shared/guards'
import { celVariableName } from './handles'
import { approvalsOf } from './approvals'
import { planGraph, type GraphCache, type GraphPlanNode } from './plan'

/** What the executor cannot do itself: submit work, say where it is, and be told to stop. */
export type GraphRunPorts = {
  /**
   * Runs one generator and resolves with the LOCAL asset ids it produced — what the collector
   * wrote, not what Scenario answered. They are handed straight to the next node's body: the
   * job manager rewrites them on submission, and a second translator here would be a second
   * truth about the same thing.
   */
  generate: (modelId: string, body: Record<string, unknown>) => Promise<readonly string[]>
  /**
   * Puts an approval node's question to whoever is watching, and resolves with their answer.
   *
   * A port like the others: the executor knows there is a person to ask, never how they are
   * asked — the buttons are the canvas's business, and a run stops here with no DOM in sight.
   */
  approve: (nodeId: string) => Promise<boolean>
  /** Evaluates one CEL expression — a port for the reason `generate` is. See `StudioBridge`. */
  transform: (
    expression: string,
    variables: GraphTransformVariables,
  ) => Promise<readonly string[] | null>
  /** Called on every change of state, so the canvas paints while the run is still going. */
  report: (nodeId: string, run: GraphNodeRun) => void
  /**
   * Nodes not started yet are left alone, and the remote generation itself is never interrupted:
   * it has been paid for, and only its own API can end it. What an abort DOES end is the host's
   * WAIT on it — `generate` may hand back nothing once this is raised, rather than parking on a
   * job that the main process would go on polling with no ceiling.
   */
  signal?: AbortSignal
}

export type GraphRunResult =
  | { ok: false; cycle: readonly string[] }
  /** The cache the next run should start from — what was reused, plus what this run produced. */
  | { ok: true; cache: GraphCache }

/** What a node hands to the ones reading it: the ids it produced, or nothing at all. */
type Outcome = { values: readonly string[] } | null

/** One node's incoming wires, read two ways: as a body's fields, and as a CEL expression's names. */
type Resolved = {
  values: Readonly<Record<string, readonly string[]>>
  variables: GraphTransformVariables
}

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
  { generate, approve, transform, report, signal }: GraphRunPorts,
): Promise<GraphRunResult> {
  const plan = planGraph(graph, cache)

  if (!plan.ok) {
    // Painted on the nodes at fault rather than thrown: a loop is something the user is still
    // wiring, and the answer to it is the nodes lighting up, not a dialog naming ids.
    for (const id of plan.cycle) report(id, { status: 'failed', failure: 'cycle' })
    return plan
  }

  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  // The approvals that actually guard something. One dropped on the canvas and left unwired, or
  // beaten to its node by a second one, compiles to no flow item at all — so it must not stop a
  // local run either, and above all must not put a question the export would never ask.
  const guarding = new Set(approvalsOf(graph).values())
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

  /**
   * What a node's wires carry, in the two shapes its readers need — resolved in one pass so a
   * provider is awaited once and the two can never disagree about what came through.
   *
   * `values` is keyed by the consumer's own port, which is what fills a generation body.
   * `variables` is keyed by `celVariableName`, which is the converter's own spelling.
   *
   * The conditional port is in the first and out of the second, exactly as it is dropped from a
   * body: it steers whether the node runs at all, and the converter skips that edge before it
   * names anything.
   */
  const resolveInputs = async (planned: GraphPlanNode): Promise<Resolved | null> => {
    const values: Record<string, readonly string[]> = {}
    const variables: Record<string, string | readonly string[]> = {}

    for (const [port, source] of Object.entries(planned.inputs)) {
      // Present by construction: a provider comes before its consumer in a topological order, so
      // its promise was made on an earlier turn of the loop below.
      const upstream = await settled.get(source.node)
      if (!upstream) return null

      values[port] = upstream.values
      if (port !== CONDITIONAL_PORT) {
        variables[celVariableName(source.node, source.output)] = asVariable(upstream.values)
      }
    }

    return { values, variables }
  }

  /** Whether every approval standing between this node and its providers was given. */
  const cleared = async (planned: GraphPlanNode): Promise<boolean> => {
    for (const id of planned.awaits) {
      // Present for the same reason an input's provider is: the plan puts an approval before
      // everything it guards, which is why it works out the dependency rather than the executor.
      if (!(await settled.get(id))) return false
    }

    return true
  }

  const stopped = (id: string): boolean => {
    if (signal?.aborted !== true) return false
    report(id, { status: 'idle' })
    return true
  }

  const decide = async (node: GraphNode): Promise<Outcome> => {
    report(node.id, { status: 'awaiting' })

    let approved = false

    try {
      approved = await approve(node.id)
    } catch {
      // A question that can no longer be answered counts as a no, and it is the safe way round:
      // no holds back what nobody validated, where yes would let it through.
    }

    if (stopped(node.id)) return null
    if (!approved) return fail(node.id, 'declined')

    report(node.id, { status: 'done' })
    // Nothing to hand on: whoever reads the guarded node reads it directly. An approval is a
    // gate, and the flow it compiles to carries a dependency rather than a value.
    return { values: [] }
  }

  /**
   * A `transformText` node: its CEL expression, over what its wires carry.
   *
   * `value` is read as data rather than as the type says, like every other field off `data`:
   * `parseGraph` validates the node and not its contents, so a graph read off a file can hold
   * anything there.
   */
  const evaluate = async (
    planned: GraphPlanNode,
    node: GraphNode,
    variables: GraphTransformVariables,
  ): Promise<Outcome> => {
    const expression = readString(node.data, 'value', '')

    // What the converter compiles an empty transform to — `''`, which produces nothing. Answered
    // here rather than sent across the boundary: a node nobody has written an expression into is
    // the state every one of them starts in.
    if (expression === '') return keep(planned, [])

    report(node.id, { status: 'running' })

    const values = await transform(expression, variables).catch(() => null)

    // Asked on the way back for the reason a generation is: a stop pressed while this was
    // crossing the boundary must not file a result in the cache the next Run would reuse.
    if (stopped(node.id)) return null

    return values ? keep(planned, values) : fail(node.id, 'invalid-expression')
  }

  const execute = async (planned: GraphPlanNode, node: GraphNode): Promise<Outcome> => {
    // Waited on BEFORE the cache is read, which is the whole point of the plan carrying them: a
    // result kept from a run somebody approved must not come back on a run they have declined.
    if (!(await cleared(planned))) {
      return stopped(node.id) ? null : fail(node.id, 'blocked')
    }

    // Read off the cache rather than off `planned.cached`, which says the same thing one step
    // further from the values: two ways of asking one question is how they come to disagree.
    // An approval never lands in it — it is `keep` that writes, and an approval never keeps.
    const held = cache.get(planned.hash)
    if (held) {
      report(node.id, { status: 'cached' })
      return { values: held }
    }

    const inputs = await resolveInputs(planned)

    // Asked after the inputs, and BEFORE the blocked branch: a stop pressed while a provider was
    // on the wire leaves what it feeds idle, rather than reporting a failure nothing caused.
    if (stopped(node.id)) return null

    if (!inputs) return fail(node.id, 'blocked')

    // Both through `asList`, and that is the fix rather than a shortening: a text node holding
    // nothing used to hand on `['']` and write an empty prompt over whatever the form held — a
    // guaranteed 400 on a required field — while an emptied ASSET node left the form alone. One
    // rule for both: a wire carrying nothing does not overwrite.
    if (node.type === 'text') return keep(planned, asList(node.data.value))
    if (node.type === 'asset') return keep(planned, asList(node.data.value))
    // A note is drawn on the canvas and compiles to nothing — it has no output to read either.
    if (node.type === 'stickyNote') return { values: [] }
    // Asked only once what it guards has produced, which the inputs above are: an approval put to
    // the user before the picture exists is a question about nothing. One guarding nothing is a
    // question about nothing too — it passes without a word rather than stopping the graph.
    if (node.type === 'approval') return guarding.has(node.id) ? decide(node) : { values: [] }
    if (node.type === 'transformText') return evaluate(planned, node, inputs.variables)
    if (node.type !== 'model') return fail(node.id, 'unsupported')

    const { modelId, form } = node.data
    if (modelId === undefined) return fail(node.id, 'no-model')

    report(node.id, { status: 'running' })

    try {
      const values = await generate(modelId, bodyOf(form, inputs.values))

      // Asked AGAIN on the way back, and it is not the same question as the one above: a stop
      // pressed while this job was on the wire cannot un-submit it, but painting the node green
      // and filing its result in the cache would make a run the user stopped look like one that
      // finished — and the next Run would then reuse what it produced.
      if (stopped(node.id)) return null

      return keep(planned, values)
    } catch {
      // A stop cancels what is on the wire, so the throw that follows is the stop rather than a
      // refusal — painting the node red would blame the API for what the user just did.
      if (stopped(node.id)) return null

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

/**
 * One provider's output as the CEL variable reading it: a string where one value came through,
 * the list where several did.
 *
 * The converter types every input of a transform `string`, but the `ref` it writes points at the
 * whole node, so what the variable HOLDS is what that node produced — a deduction from its code,
 * not something an API answer has been read for.
 *
 * **Nothing produced reads as empty TEXT, not as an empty list**, and that is the one place this
 * departs from `asList` above. A text node holding nothing compiles to `''` on Scenario's side;
 * handed `[]`, the ordinary `'a photo of ' + text1_output` would fail to evaluate rather than
 * answering the sentence with a blank in it.
 */
function asVariable(values: readonly string[]): string | readonly string[] {
  if (values.length === 0) return ''

  const [only] = values
  return values.length === 1 && only !== undefined ? only : values
}

const asList = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return value === '' ? [] : [value]
  if (Array.isArray(value)) return value.filter(held => typeof held === 'string')
  return []
}

/**
 * The body one generator is submitted with: what its form holds, with what its wires feed on top.
 *
 * **It is NOT `buildBody`, and the difference is worth naming rather than hiding.** `buildBody`
 * keeps only `visibleFields`, so a parameter whose `dependsOn` is not satisfied is dropped before
 * a form is submitted; this has no `FieldDescriptor` to read that from — the schema lives in the
 * main process and an engine may not reach for it (invariant 4) — so a node nobody opened in the
 * inspector, which carries `defaultValues` for EVERY field, submits its hidden ones too. Two
 * paths, two bodies for one form. Closing it means handing the descriptors down as a port, and
 * that is written up in `docs/todo.md` rather than left for someone to rediscover.
 *
 * What it does do is drop the blanks, which is the half that would otherwise 400 on its own: an
 * optional enum sitting at `''` is refused outright.
 */
function bodyOf(
  form: Readonly<Record<string, unknown>> | undefined,
  inputs: Readonly<Record<string, readonly string[]>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  // `null` as well as `''`: `parseGraph` does not validate `data`, so a form read off a file can
  // hold one, and `blankToUndefined` — the reader on the other path — drops it too.
  for (const [key, value] of Object.entries(form ?? {})) {
    if (value !== '' && value !== undefined && value !== null) body[key] = value
  }

  for (const [key, values] of Object.entries(inputs)) {
    // The port every node carries to be steered by, never a parameter of the model. Wired — which
    // an untyped output makes possible, and graphs read from Scenario carry those — it would put a
    // key the schema has never heard of in the body.
    if (key === CONDITIONAL_PORT) continue

    // A provider that produced nothing leaves the key alone rather than writing over whatever the
    // form held for it.
    if (values.length === 0) continue

    // The form's own value decides the arity, and nothing else does: a picture input is a single
    // `file` in every schema this studio reads (`schema.ts` only calls a `file` an image), so a
    // node that produced four and wrote all four would be refused. The first is what fits.
    body[key] = Array.isArray(body[key]) ? values : values[0]
  }

  return body
}
