import {
  convertWorkflowEditorToFlow,
  validateWorkflowFlow,
  type WorkflowEditorEdge,
  type WorkflowEditorFlowItem,
  type WorkflowEditorModel,
  type WorkflowEditorNode,
} from '@scenario-labs/sdk'
import type { GraphEdge, GraphNode, GraphState } from '@shared/domain/graph'
import {
  namedLoopId,
  outputNodesOf,
  type GraphCompileProblem,
  type GraphCompileResult,
} from '@shared/domain/graph'
import { messageOf } from '@shared/guards'
import type { ScenarioInput } from './schema'

/**
 * The studio's node as the converter's own union — a `switch` rather than an assertion.
 *
 * The two unions are the same shape written twice, because `shared/` carries no runtime
 * dependency (invariant 2), and TypeScript cannot see that a narrowed `type` picks the matching
 * arm of the OTHER union. Spelling the arms out costs fourteen lines and buys two things a cast
 * would have thrown away: a sixteenth node type stops compiling — in `unhandled` below, which is
 * what makes that true and without which the `switch` proved nothing — and `stickyNote`, which
 * the converter's union has no variant for at all, is refused by the type system rather than by
 * a list kept in step by hand.
 *
 * `undefined` for a node that does not compile. `data` is handed over as it stands: `parseGraph`
 * validates the node and not its contents, and the converter reads it defensively.
 */
function asEditorNode(node: GraphNode): WorkflowEditorNode | undefined {
  const id = node.id
  const data: Record<string, unknown> = { ...node.data }

  switch (node.type) {
    case 'model':
      return { id, type: 'model', data }
    case 'llm':
      return { id, type: 'llm', data }
    case 'text':
      return { id, type: 'text', data }
    case 'asset':
      return { id, type: 'asset', data }
    case 'transformText':
      return { id, type: 'transformText', data }
    case 'splitText':
      return { id, type: 'splitText', data }
    case 'aspectRatio':
      return { id, type: 'aspectRatio', data }
    case 'groupItems':
      return { id, type: 'groupItems', data }
    case 'sliceAssets':
      return { id, type: 'sliceAssets', data }
    case 'forEach':
      return { id, type: 'forEach', data }
    case 'forEachEnd':
      return { id, type: 'forEachEnd', data }
    case 'ifElse':
      return { id, type: 'ifElse', data }
    case 'approval':
      return { id, type: 'approval', data }
    case 'modelInput':
      // The one arm with a REQUIRED field. Without a name it is a workflow input nothing can be
      // asked for, and the converter would key the flow's inputs on `undefined`.
      return typeof data.inputName === 'string'
        ? { id, type: 'modelInput', data: { ...data, inputName: data.inputName } }
        : undefined
    // Drawn on the canvas, part of no flow: the converter's union has no variant for it.
    case 'stickyNote':
      return undefined
  }

  // Outside the `switch` rather than a `default` arm, which would be a branch no test can enter
  // and which the coverage budget of this folder counts as one.
  return unhandled(node)
}

/**
 * The arm a sixteenth node type would not have.
 *
 * Without it the `switch` proves nothing: `noImplicitReturns` is off and the function already
 * answers `undefined`, so a type added to the union would fall out of every flow in silence.
 * Reached only by a type the compiler cannot see, which is why the parameter is `never`.
 */
const unhandled = (_node: never): undefined => undefined

const asEditorEdge = (edge: GraphEdge): WorkflowEditorEdge => ({
  source: edge.source,
  target: edge.target,
  ...(edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle }),
  ...(edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle }),
})

/**
 * A model as the converter reads one — its inputs, under the API's own type names.
 *
 * Only `inputs` is filled. `uiConfig` feeds aspect-ratio presets, which no node can ask for
 * until the editor can create an `aspectRatio` node, and `tags` only tells the converter whether
 * a model is `compose`, which needs the nested inputs of an `inputs_array` — a shape
 * `ScenarioInput` does not carry and no model of the account publishes. Both are written down
 * here rather than half-filled, so a lot that needs them knows where to start.
 */
export const editorModelOf = (
  modelId: string,
  inputs: readonly ScenarioInput[],
): WorkflowEditorModel => ({
  id: modelId,
  inputs: inputs.map(input => ({
    name: input.name,
    type: input.type,
    ...(input.min === undefined ? {} : { min: input.min }),
    ...(input.max === undefined ? {} : { max: input.max }),
    ...(input.step === undefined ? {} : { step: input.step }),
    ...(input.allowedValues === undefined
      ? {}
      : { allowedValues: input.allowedValues.map(String) }),
  })),
})

/**
 * Every model a graph names, once each — what has to be resolved before the converter runs.
 *
 * `llm` carries its model id in the same field as `model`, under the arm that types nothing but
 * the common data, so both are read the way `parseGraph` leaves them: as data, never as a shape
 * the compiler was promised.
 */
export function modelIdsOf(graph: GraphState): readonly string[] {
  const ids = new Set<string>()

  for (const node of graph.nodes) {
    if (node.type !== 'model' && node.type !== 'llm') continue

    const data: Record<string, unknown> = { ...node.data }
    if (typeof data.modelId === 'string' && data.modelId !== '') ids.add(data.modelId)
  }

  return [...ids]
}

export type CompileDeps = {
  /** Where the validator's own sentence goes: a developer's English, never the user's screen. */
  report: (message: string) => void
  /**
   * The models of the graph, ALREADY resolved — the converter is synchronous and the registry is
   * not, so the awaiting happens before the call rather than inside it.
   *
   * Without it the converter derives no `modelInputs` and skips every wire it cannot name, which
   * drops a generator's whole incoming wiring while its form values sail through: a flow that
   * validates, exports, and generates from nothing.
   */
  getModel?: (modelId: string) => WorkflowEditorModel | undefined
}

/**
 * The graph as Scenario's own flow — what an export sends, and what a test can look at.
 *
 * **No compiler is written here.** `convertWorkflowEditorToFlow` is Scenario's own, so the studio
 * cannot drift from what the webapp produces; this file adapts, and it REFUSES — `compileGraph`
 * below carries two refusals of the studio's own, for shapes the SDK's validator accepts without
 * a word. Adapting is still all that happens on the way to the flow.
 *
 * Exported rather than hidden inside `compileGraph`, for two reasons pointing the same way: the
 * step 9 export needs this very array, and a verdict reduced to a number is a contract no test can
 * hold to account — four mutations of the adapter survived a suite that could only assert `ok`.
 *
 * **`getModel` decides whether the wires survive**, which is why the caller resolves the models
 * first: the converter derives `modelInputs` from it and skips every wire it cannot name
 * (`if (!modelInput) continue`). Handed nothing, it keeps a generator's form values and drops its
 * whole incoming wiring — a flow that validates and exports, and generates from nothing.
 */
export function toEditorFlow(
  graph: GraphState,
  getModel?: (modelId: string) => WorkflowEditorModel | undefined,
): readonly WorkflowEditorFlowItem[] {
  const nodes: WorkflowEditorNode[] = []
  for (const node of graph.nodes) {
    const editor = asEditorNode(node)
    if (editor) nodes.push(editor)
  }

  return convertWorkflowEditorToFlow({
    nodes,
    edges: graph.edges.map(asEditorEdge),
    inputKeys: [...graph.inputKeys],
    ...(getModel ? { getModel } : {}),
  })
}

/**
 * Who reads whom, indexed once — data flows provider to consumer while the EDGE points the other
 * way, so this is `target` to `source`.
 *
 * Built once for the whole check rather than per loop, as `planGraph` builds its own: walked
 * straight off `graph.edges`, every step of every walk would rescan the lot.
 */
function consumersByProvider(graph: GraphState): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>()

  for (const edge of graph.edges) {
    const found = index.get(edge.target)
    if (found) found.push(edge.source)
    else index.set(edge.target, [edge.source])
  }

  return index
}

/**
 * Every node that reads this one, however far down.
 *
 * Indexed rather than iterated, as `plan.ts` walks its own queue: the list grows while it is being
 * read, and `shift` on it would recopy the rest on every turn.
 */
function reachedFrom(
  consumers: ReadonlyMap<string, readonly string[]>,
  id: string,
): ReadonlySet<string> {
  const reached = new Set<string>()
  const queue = [id]

  // Walked while it grows, which an array iterator allows — it reads `length` on every turn, as
  // `plan.ts` does it. Indexed instead, the bound would guarantee an element the TYPE does not,
  // and the `?? ''` covering that gap is a branch no test could ever enter.
  for (const current of queue) {
    for (const consumer of consumers.get(current) ?? []) {
      if (reached.has(consumer)) continue
      reached.add(consumer)
      queue.push(consumer)
    }
  }

  return reached
}

/**
 * How a loop and its end can be paired so the converter reads a WIRE differently from the screen.
 *
 * **Neither of the two is refused by `validateWorkflowFlow`**, which is the whole reason this
 * exists. Both were measured by running the converter, and so was every case left out below.
 *
 * The defect is always about a wire LEAVING an end: `getSourceRef` resolves one to the node the
 * end names, whatever that node is and wherever the end sits. An end nothing reads therefore
 * cannot misroute anything, and refusing one would refuse a graph that compiles — measured: a
 * second end with no wire at all gives a flow identical, item for item, to the graph without it.
 *
 * Left out, each for its own measured reason:
 * - a loop NO end names: its body compiles empty and the validator does refuse it, so it already
 *   arrives as `invalid` — which says less than it could but does not lie;
 * - an end nothing reads, whatever it names;
 * - an end naming a node the graph no longer holds: the lookup answers nothing and the wire is
 *   simply dropped, which is the same as drawing no wire.
 */
function loopPairingProblem(graph: GraphState): 'loop-end-outside' | 'loop-two-ends' | undefined {
  const consumers = consumersByProvider(graph)
  const read: { end: string; names: string }[] = []
  const firstEnd = new Map<string, string>()

  for (const node of graph.nodes) {
    // The inspector's own reader, not a second one: it guards what a file may have written under
    // `parentNodeId`, and two readings of one field are two chances to disagree about it.
    const names = namedLoopId(node)
    if (names === undefined) continue
    // In NODE ORDER, because that is how the converter picks: `nodes.find`, first match wins.
    if (!firstEnd.has(names)) firstEnd.set(names, node.id)
    if ((consumers.get(node.id) ?? []).length > 0) read.push({ end: node.id, names })
  }

  const loops = new Set(graph.nodes.filter(node => node.type === 'forEach').map(node => node.id))

  /*
   * A loop whose read end is NOT the one the converter retained. The retained end is where the
   * body walk stops; wires leaving any other end still resolve to the loop, so whatever reads one
   * is pulled INTO the body and runs once per item instead of once — measured, a list of ten turns
   * two generations into twenty, paid for, with `validateWorkflowFlow` answering OK.
   *
   * The POSITION is what decides, and that is not a detail: the same two ends with the spare one
   * written after the read one compile to a flow identical, item for item, to the graph without
   * it. Counting ends would refuse that graph — measured too.
   *
   * Only over real loops, and that is why this one asks the type while the check below does not:
   * "the converter keeps the first end" happens in the scan it runs PER `forEach`, so two ends
   * naming a generator do nothing of the sort. The check below is about `getSourceRef`, which runs
   * for whatever a wire leaves.
   */
  for (const entry of read) {
    if (!loops.has(entry.names)) continue
    if (firstEnd.get(entry.names) !== entry.end) return 'loop-two-ends'
  }

  // An end that does not close what it names, either because that is no loop at all or because the
  // end is not downstream of it. Measured both ways: the wire leaving it lands on the named node
  // instead of its own provider, or is dropped and the reader falls back to its form.
  for (const entry of read) {
    if (!graph.nodes.some(node => node.id === entry.names)) continue
    // Reachability alone, and NOT "is the named node a loop": the harness showed the second test
    // never firing on its own. An end downstream of what it names resolves to it either way, loop
    // or not — and an end that is not downstream is misrouted whatever it named.
    if (!reachedFrom(consumers, entry.names).has(entry.end)) return 'loop-end-outside'
  }

  return undefined
}

/**
 * Why that flow would not be accepted, or `null` when it would.
 *
 * Apart from `compileGraph` because the PUBLICATION needs the very same answers and already holds
 * the flow: asked of the compile it would compile twice, and written a second time it would be two
 * verdicts on one question — which is how a graph the editor paints red gets published as `ready`
 * anyway. The loop pairing is in here for that very reason: it is the refusal `validateWorkflowFlow`
 * does NOT make, so a publication that skipped it would send the one flow nothing else catches.
 */
export function refuseFlow(
  graph: GraphState,
  flow: readonly WorkflowEditorFlowItem[],
  report: (message: string) => void,
): GraphCompileProblem | null {
  // "Nothing is marked as an output" is the one cause of an empty flow the user can act on.
  if (outputNodesOf(graph).length === 0) return 'no-output'

  // Before anything read off the flow, because the conversion is exactly what hides it: these
  // graphs convert and validate without a word, and the flow that comes out has a wire the graph
  // does not.
  const pairing = loopPairingProblem(graph)
  if (pairing) return pairing

  if (flow.length === 0) return 'empty'

  try {
    // Copied because the validator takes a mutable array. It reads only — checked in
    // `workflow_validator.js` — but the export's own answer must not be handed free rein over,
    // so the copy stays on this side rather than the type being loosened.
    validateWorkflowFlow([...flow])
  } catch (error) {
    // The sentence names a node and what is wrong with it, which is worth keeping — in the
    // journal, where a developer reads it. The screen gets the code.
    report(messageOf(error))
    return 'invalid'
  }

  return null
}

/** Whether that flow holds together, and the refusals the converter answers with silence. */
export function compileGraph(
  graph: GraphState,
  { report, getModel }: CompileDeps,
): GraphCompileResult {
  // Asked of `refuseFlow` and not repeated here, though this runs on every edit: a second copy of
  // the two cheap refusals would be two verdicts on one question, and the converter answers a
  // graph nothing reads by filtering it down to nothing — the work saved was not worth the risk.
  const flow = toEditorFlow(graph, getModel)
  const problem = refuseFlow(graph, flow, report)

  return problem ? { ok: false, problem } : { ok: true, steps: flow.length }
}
