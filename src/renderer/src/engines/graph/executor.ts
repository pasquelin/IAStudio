import type {
  GraphNode,
  GraphNodeRun,
  GraphRunFailure,
  GraphState,
  GraphTransformVariables,
} from '@shared/domain/graph'
import { CONDITIONAL_PORT } from '@shared/domain/graph'
import { blockToCel } from '@shared/domain/branch'
import { readString } from '@shared/guards'
import { celVariableName, DEFAULT_OUTPUT_NAME, outputHandlesOf } from './handles'
import { approvalsOf } from './approvals'
import { conditionBlocksOf } from './conditions'
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

/**
 * What a node hands to the ones reading it, **by output port**, or why it handed nothing.
 *
 * By port and no longer flat, because a node can have more than one: `ifElse` produces on the
 * branch it chose and on none of the others, and a reader wired to a branch that was not taken
 * must see nothing rather than see what a sibling branch produced. Every other node declares one
 * port, so its record holds one entry — `outputName` says which.
 *
 * Three facts, three names. `stalled` deliberately covers BOTH a node that went wrong and a run
 * the user ended: a reader does the same thing with either — it has nothing to read — and the one
 * place the difference matters, painting the node, is decided by whoever reports, not by whoever
 * reads.
 */
type Outcome =
  | { kind: 'produced'; values: Readonly<Record<string, readonly string[]>> }
  | { kind: 'skipped' }
  | { kind: 'stalled' }

/** Whoever hands this back has just painted the node — `fail` red, `stopped` idle. */
const STALLED: Extract<Outcome, { kind: 'stalled' }> = { kind: 'stalled' }

/**
 * What a reader makes of a provider that handed back no values.
 *
 * A `switch` over `Exclude<Outcome, produced>` with its return type written down, and that is the
 * point: a ternary falling through to `blocked` would paint a FUTURE member red in silence, where
 * this stops the build. Narrowing stays with the caller, which needs `values` right after.
 */
const withoutValues = (
  outcome: Exclude<Outcome, { kind: 'produced' }>,
): Exclude<Reach, 'ready'> => {
  switch (outcome.kind) {
    case 'skipped':
      return 'skipped'
    case 'stalled':
      return 'blocked'
  }
}

/**
 * Every port a node publishes its one result on.
 *
 * ALL of them, not the first: a node that is not a branch produces one value and offers it to
 * whoever reads any of its outputs — which is what a flat outcome did before it was keyed by port.
 * Keying under the first alone made a reader of a second declared output — `firstOutput` beside
 * `output`, a shape the converter knows — read as a branch nobody took: grey, silent, and wrong.
 *
 * `DEFAULT_OUTPUT_NAME` where a node declares no port at all, which is the fallback the plan
 * resolves an edge to on the other side.
 */
const outputNames = (node: GraphNode): readonly string[] => {
  const declared = outputHandlesOf(node).map(handle => handle.name ?? DEFAULT_OUTPUT_NAME)
  return declared.length > 0 ? declared : [DEFAULT_OUTPUT_NAME]
}

/** Why a node is not going to run: something it reads failed, or no branch ever reached it. */
type Reach = 'ready' | 'skipped' | 'blocked'

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

  /**
   * What a node settled on, awaited.
   *
   * Present by construction — the plan is topological, so a provider's promise was made on an
   * earlier turn of the loop below, and an approval comes before everything it guards. A node the
   * plan never ordered gave nothing all the same, which is what a stall is.
   */
  const settledOn = async (id: string): Promise<Outcome> => (await settled.get(id)) ?? STALLED

  const fail = (id: string, failure: GraphRunFailure): Outcome => {
    report(id, { status: 'failed', failure })
    return STALLED
  }

  /**
   * A node no branch reached, and everything downstream of it.
   *
   * Apart from `blocked`, and the distinction is the whole point of this: `blocked` says something
   * it reads FAILED, and paints red. A node on the branch a condition did not choose has nothing
   * wrong with it — painting it red would report a fault where the graph did exactly what it was
   * wired to do. It hands on `'skipped'` so its own readers say the same rather than blame it.
   */
  const skip = (id: string): Outcome => {
    report(id, { status: 'skipped' })
    return { kind: 'skipped' }
  }

  const keep = (planned: GraphPlanNode, node: GraphNode, values: readonly string[]): Outcome => {
    produced.set(planned.hash, values)
    report(planned.id, { status: 'done' })
    return {
      kind: 'produced',
      values: Object.fromEntries(outputNames(node).map(port => [port, values])),
    }
  }

  /**
   * A branch's answer: the values it was handed, on the one port it chose, and **nothing in the
   * cache**.
   *
   * Uncached on purpose. The cache is keyed by hash and holds a flat list, so a reused entry could
   * only ever come back on the FIRST port — a branch read from cache would route every run the
   * same way, whatever its condition now says. A branch produces nothing anyway: it routes what it
   * already received, and re-deciding costs one CEL evaluation.
   */
  const routeTo = (id: string, ports: readonly string[], values: readonly string[]): Outcome => {
    report(id, { status: 'done' })
    return { kind: 'produced', values: Object.fromEntries(ports.map(port => [port, values])) }
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
   *
   * Several wires onto one port concatenate in edge order, each still naming a variable of its
   * own; a scalar port then takes the head, which is the `inputEdges[0]` the converter takes.
   */
  const resolveInputs = async (
    planned: GraphPlanNode,
    node: GraphNode,
  ): Promise<Resolved | Exclude<Reach, 'ready'>> => {
    const values: Record<string, readonly string[]> = {}
    const variables: Record<string, string | readonly string[]> = {}

    for (const [port, sources] of Object.entries(planned.inputs)) {
      const carried: string[] = []

      for (const source of sources) {
        const upstream = await settledOn(source.node)
        if (upstream.kind !== 'produced') return withoutValues(upstream)

        // The port the edge leaves from, never the whole node: a branch that was not taken has
        // no entry here, and reading the node flat would hand on what another branch produced.
        // `hasOwn` and not a bare lookup: a file is free to name a port `toString`, and reading
        // it off the prototype would hand back a FUNCTION — the spread below then throws, the
        // whole run dies, and nothing on screen says why. `plan.ts` guards the same class on the
        // way in with a `Map`; this is the way out.
        const through = Object.hasOwn(upstream.values, source.output)
          ? upstream.values[source.output]
          : undefined

        if (!through) {
          // Absent because the provider produced on ANOTHER of its ports: a branch the condition
          // did not choose, and nothing went wrong. Absent because it produced on none at all:
          // the wire names a port that does not exist, which is a graph read off a file rather
          // than a branch — red, not a quiet grey.
          return Object.keys(upstream.values).length > 0 ? 'skipped' : 'blocked'
        }

        carried.push(...through)
        // The conditional port is named for a branch and only for a branch: everywhere else it is
        // the gate an approval or a branch holds, and the converter skips that edge before it
        // names anything. On the branch ITSELF it is the value being tested. Named HERE rather
        // than rebuilt later, so each provider keeps ITS OWN values — rebuilt from the port's
        // concatenation, two providers in one condition would both read both.
        if (port !== CONDITIONAL_PORT || node.type === 'ifElse') {
          variables[celVariableName(source.node, source.output)] = asVariable(through)
        }
      }

      values[port] = carried
    }

    return { values, variables }
  }

  /**
   * How far the approvals standing between this node and its providers let it get: given, never
   * asked because no branch reached them, or refused.
   */
  const reachOf = async (planned: GraphPlanNode): Promise<Reach> => {
    for (const id of planned.awaits) {
      const answer = await settledOn(id)
      // An approval on a branch nobody took was never asked, so what it guards was not refused —
      // it was not reached either.
      if (answer.kind !== 'produced') return withoutValues(answer)
    }

    return 'ready'
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

    if (stopped(node.id)) return STALLED
    if (!approved) return fail(node.id, 'declined')

    report(node.id, { status: 'done' })
    // Nothing to hand on: whoever reads the guarded node reads it directly. An approval is a
    // gate, and the flow it compiles to carries a dependency rather than a value.
    return { kind: 'produced', values: {} }
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
    if (expression === '') return keep(planned, node, [])

    report(node.id, { status: 'running' })

    const values = await transform(expression, variables).catch(() => null)

    // Asked on the way back for the reason a generation is: a stop pressed while this was
    // crossing the boundary must not file a result in the cache the next Run would reuse.
    if (stopped(node.id)) return STALLED

    return values ? keep(planned, node, values) : fail(node.id, 'invalid-expression')
  }

  /**
   * An `ifElse`: the first branch whose condition says true, else the last port.
   *
   * It produces nothing of its own — it hands on what its `conditional` port carries, to the one
   * output the condition chose. Every other output stays absent from the outcome, which is how a
   * reader wired to a branch that was not taken sees nothing rather than a sibling's value.
   *
   * The CEL is Scenario's own, character for character (`shared/domain/branch.ts`), and it is
   * evaluated by the same port `transformText` goes through. Deciding a branch here differently
   * from the published workflow is the one defect this must not have.
   */
  const route = async (
    planned: GraphPlanNode,
    node: GraphNode,
    inputs: Resolved,
  ): Promise<Outcome> => {
    /**
     * Approval handles are dropped before anything is counted, because the converter drops them:
     * `// Approval handles are UI-only and must not shift case/else indices.` A node carrying one
     * would otherwise pair block 1 with the approval's port, and every branch would route one
     * place off — silently, since both ends are well-formed ports.
     */
    const ports = outputHandlesOf(node).filter(port => port.type !== 'approval')
    const blocks = conditionBlocksOf(node)
    const carried = inputs.values[CONDITIONAL_PORT] ?? []

    /**
     * A condition names a PROVIDER NODE; the studio binds that provider to a CEL variable.
     *
     * Only the mapping is built here — the VALUES come from `resolveInputs`, which already holds
     * one entry per provider. Rebuilding them from the port's own list would hand every provider
     * the concatenation of them all, and a condition over two of them would read both twice.
     */
    const named = new Map<string, string>()

    for (const sources of Object.values(planned.inputs)) {
      for (const source of sources) {
        named.set(source.node, celVariableName(source.node, source.output))
      }
    }

    report(node.id, { status: 'running' })

    for (const [index, block] of blocks.entries()) {
      const expression = blockToCel(block, field => named.get(field))
      // Nothing readable to test is not the same as false: a branch the converter compiles to no
      // case at all cannot be taken, and the run walks on to the next one.
      if (expression === '') continue

      const answer = await transform(expression, inputs.variables).catch(() => null)
      if (stopped(node.id)) return STALLED
      if (!answer) return fail(node.id, 'invalid-expression')

      // `['true']` because a boolean crosses the boundary as text — `workflow-transform.ts` calls
      // `String` on it and wraps the result in a list.
      if (answer[0] !== 'true') continue

      // A file may carry fewer ports than blocks. A condition that held with nowhere to send what
      // it matched is not a branch to walk past in silence — it is a graph that cannot be run.
      const port = ports[index]
      if (port === undefined) return fail(node.id, 'unwired')

      // Read as the else below reads its own: an absent NAME is not an absent PORT.
      return routeTo(node.id, [port.name ?? DEFAULT_OUTPUT_NAME], carried)
    }

    /**
     * EVERY port past the last block is the else, not just the first of them: the converter reads
     * `handleIndex >= blocks.length` as the default, and `grownTo` says in as many words that a
     * file carrying more ports than blocks is carrying several else ports and that trimming them
     * would be this editor deciding what a document it did not write meant.
     */
    // A nameless port is a port all the same — the plan wires one under `output`, and a file is
    // free to leave the name off. Dropping it turned a graph Scenario routes into a red node.
    const fallbacks = ports.slice(blocks.length).map(port => port.name ?? DEFAULT_OUTPUT_NAME)

    if (fallbacks.length === 0) return fail(node.id, 'unwired')

    return routeTo(node.id, fallbacks, carried)
  }

  const execute = async (planned: GraphPlanNode, node: GraphNode): Promise<Outcome> => {
    // Before the inputs, and both before the cache: a REFUSED approval outweighs a merely skipped
    // provider, and a result kept from a run somebody approved must not come back on a run they
    // have declined.
    const gate = await reachOf(planned)

    if (gate !== 'ready') {
      if (stopped(node.id)) return STALLED
      return gate === 'skipped' ? skip(node.id) : fail(node.id, 'blocked')
    }

    const inputs = await resolveInputs(planned, node)

    // Asked after the inputs, and BEFORE the blocked branch: a stop pressed while a provider was
    // on the wire leaves what it feeds idle, rather than reporting a failure nothing caused.
    if (stopped(node.id)) return STALLED

    if (inputs === 'skipped') return skip(node.id)
    if (inputs === 'blocked') return fail(node.id, 'blocked')

    // Read AFTER the inputs, for the same reason: a branch routes by PORT ORDER, which is out of
    // the hash, so swapping two of a branch's ports leaves every hash downstream identical while
    // the routing changed underneath. A reader off a branch nobody took must go grey, not come
    // back green off a run that took it.
    //
    // Read off the cache rather than off `planned.cached`, which says the same thing one step
    // further from the values: two ways of asking one question is how they come to disagree.
    // An approval never lands in it — it is `keep` that writes, and an approval never keeps.
    const held = cache.get(planned.hash)
    if (held) {
      report(node.id, { status: 'cached' })
      return {
        kind: 'produced',
        values: Object.fromEntries(outputNames(node).map(port => [port, held])),
      }
    }

    // Both through `asList`, and that is the fix rather than a shortening: a text node holding
    // nothing used to hand on `['']` and write an empty prompt over whatever the form held — a
    // guaranteed 400 on a required field — while an emptied ASSET node left the form alone. One
    // rule for both: a wire carrying nothing does not overwrite.
    if (node.type === 'text') return keep(planned, node, asList(node.data.value))
    if (node.type === 'asset') return keep(planned, node, asList(node.data.value))
    // A note is drawn on the canvas and compiles to nothing — it has no output to read either.
    if (node.type === 'stickyNote') return { kind: 'produced', values: {} }
    // Asked only once what it guards has produced, which the inputs above are: an approval put to
    // the user before the picture exists is a question about nothing. One guarding nothing is a
    // question about nothing too — it passes without a word rather than stopping the graph.
    if (node.type === 'approval')
      return guarding.has(node.id) ? decide(node) : { kind: 'produced', values: {} }
    if (node.type === 'transformText') return evaluate(planned, node, inputs.variables)
    if (node.type === 'ifElse') return route(planned, node, inputs)
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
      if (stopped(node.id)) return STALLED

      return keep(planned, node, values)
    } catch {
      // A stop cancels what is on the wire, so the throw that follows is the stop rather than a
      // refusal — painting the node red would blame the API for what the user just did.
      if (stopped(node.id)) return STALLED

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
