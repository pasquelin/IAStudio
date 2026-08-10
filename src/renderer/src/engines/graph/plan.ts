import type { GraphEdge, GraphNode, GraphNodeData, GraphState } from '@shared/domain/graph'
import { digest, stableKey } from '@shared/hash'
import { approvalsOf } from './approvals'
import { DEFAULT_OUTPUT_NAME, inputHandlesOf, outputHandleOf } from './handles'

/**
 * Which node, and through which of its output ports, feeds one input port.
 *
 * `output` is the port's NAME, not its handle id — `?? 'output'` where it declares none, which is
 * the converter's own fallback. A name because that is what a reader of the plan needs: it is
 * half of what Scenario calls the wire (`` `${node}_${output}` ``), and nothing anywhere reads a
 * provider's handle id. Resolved here rather than by every reader, beside the input ports the
 * plan already resolves.
 */
export type GraphPlanInput = { node: string; output: string }

export type GraphPlanNode = {
  id: string
  /** The cache key: the same hash means the same result, so the node need not run again. */
  hash: string
  /** What feeds each input port, keyed by the port's name — a model's own field key. */
  inputs: Readonly<Record<string, GraphPlanInput>>
  /**
   * The nodes whose outcome this one waits on without reading a value from them: today, the
   * approvals standing between it and what feeds it.
   *
   * Kept apart from `inputs` because it must not reach a body — an approval produces nothing to
   * submit — and out of the hash because a question asked of a person says nothing about what the
   * node computes.
   */
  awaits: readonly string[]
  /** Whether a result is already held for this hash. */
  cached: boolean
}

/**
 * The order a graph may run in, or the nodes that forbid one.
 *
 * A result rather than a throw: a cycle is something the editor paints on the nodes at fault,
 * not an accident — and it is drawn while the user is still wiring, long before any Run.
 */
export type GraphPlan =
  { ok: true; order: readonly GraphPlanNode[] } | { ok: false; cycle: readonly string[] }

/**
 * What a run has already produced, by node hash. Read here; the executor is what fills it.
 *
 * A `Map`, and therefore SESSION state — deliberately, not by omission. It holds local asset ids,
 * which mean nothing outside the open project, and `JSON.stringify` empties a `Map` in silence:
 * whoever decides to write this beside the document owes it a `Record` and a reader, and should
 * make that a decision rather than inherit it from a type.
 */
export type GraphCache = ReadonlyMap<string, readonly string[]>

/**
 * The fields of `data` that say nothing about what a node COMPUTES, so nothing a cache may key on.
 *
 * Complete over `GraphNodeData` by construction: a field added there stops compiling until it is
 * placed on one side or the other. Everything a node type adds of its own — `value`, `modelId`,
 * `form`, an asset's kind — is hashed without having to be listed, which is the safe default:
 * a new parameter counts until someone says it does not.
 */
const NOT_COMPUTED: Record<keyof GraphNodeData, true> = {
  inputHandles: true,
  outputHandles: true,
  isInput: true,
  isOutput: true,
  group: true,
  title: true,
}

/** What a node holds that decides its result. Position, size and title are not in `data` at all. */
function paramsOf(node: GraphNode): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  for (const key of Object.keys(node.data)) {
    // Own keys only: a field named like one of `Object.prototype`'s would otherwise read as
    // excluded and drop out of the cache key without a word.
    if (!Object.hasOwn(NOT_COMPUTED, key)) params[key] = Reflect.get(node.data, key)
  }

  return params
}

function inputsOf(
  node: GraphNode,
  incoming: readonly GraphEdge[],
  byId: ReadonlyMap<string, GraphNode>,
): Readonly<Record<string, GraphPlanInput>> {
  const inputs: Record<string, GraphPlanInput> = {}

  // Flattened once rather than per edge: `inputHandlesOf` walks the sub-handles and allocates as
  // it goes, and a node with ten wires into thirty ports paid for that ten times.
  const ports = inputHandlesOf(node)

  for (const edge of incoming) {
    if (edge.sourceHandle === undefined || edge.targetHandle === undefined) continue

    // A port's `name` is the model's own field key (`modelPorts`), which is what fills a body.
    // Its id stands in for a handle a file names but the node no longer carries.
    const port = ports.find(candidate => candidate.id === edge.sourceHandle)
    // The provider is in the index by construction: an edge missing either end was filtered out
    // before this ran, which is what makes the fallback below about a NAMELESS port, not a
    // missing node.
    const provider = byId.get(edge.target)
    const output = provider && outputHandleOf(provider, edge.targetHandle)?.name

    inputs[port?.name ?? edge.sourceHandle] = {
      node: edge.target,
      output: output ?? DEFAULT_OUTPUT_NAME,
    }
  }

  return inputs
}

/**
 * The cache key of one node: what it is, what it holds, and what its providers hashed to.
 *
 * **`node.id` is in the hash, and that is not an oversight.** Generation is stochastic, so two
 * nodes carrying the same model and the same prompt are asking for two different pictures — the
 * one thing a cache must never do here is hand them the same one.
 *
 * Built from the edges rather than from `inputs`, which is keyed by port name: a file may spell
 * two edges onto one name, and the map keeps only the last of them.
 */
function hashOf(
  node: GraphNode,
  incoming: readonly GraphEdge[],
  hashes: ReadonlyMap<string, string>,
): string {
  const from = incoming
    // A provider is always hashed before its consumer — that is what the topological order buys.
    .map(edge => [edge.sourceHandle ?? '', edge.targetHandle ?? '', hashes.get(edge.target) ?? ''])
    .map(stableKey)
    .sort()

  return digest(stableKey({ id: node.id, type: node.type, params: paramsOf(node), from }))
}

/**
 * The order the nodes of a graph may run in, each with the key its result is cached under.
 *
 * Kahn, over Scenario's INVERTED edge convention: `edge.source` is the consumer and `edge.target`
 * the provider, so what feeds a node is `edges.filter(e => e.source === id)`. Wired the intuitive
 * way this still terminates and still looks right — it just runs the graph backwards.
 */
export function planGraph(graph: GraphState, cache?: GraphCache): GraphPlan {
  const byId = new Map(graph.nodes.map(node => [node.id, node]))

  // An edge missing either end is not a dependency. Left counted, its consumer's in-degree never
  // reaches zero and a perfectly acyclic graph reports a cycle. `removeNode` clears them; a file
  // read off disk is not made to.
  const edges = graph.edges.filter(edge => byId.has(edge.source) && byId.has(edge.target))

  const awaited = awaitedApprovals(graph, edges)

  const incoming = new Map<string, GraphEdge[]>()
  // Ordering, which is the edges PLUS the approvals: what a node reads and what it merely waits
  // for are two questions, and only the first fills a body. Kept in one index all the same, so
  // Kahn, the in-degree and the cycle report all read the same dependencies.
  const outgoing = new Map<string, GraphEdge[]>()
  const waitingOn = new Map(graph.nodes.map(node => [node.id, 0]))

  // `source` is the consumer and `target` the provider, here as everywhere in this format.
  const depend = (edge: GraphEdge): void => {
    push(outgoing, edge.target, edge)
    waitingOn.set(edge.source, (waitingOn.get(edge.source) ?? 0) + 1)
  }

  for (const edge of edges) {
    push(incoming, edge.source, edge)
    depend(edge)
  }

  for (const [consumer, approvals] of awaited) {
    for (const approval of approvals) depend({ id: '', source: consumer, target: approval })
  }

  const hashes = new Map<string, string>()
  const order: GraphPlanNode[] = []
  const ready = graph.nodes.filter(node => waitingOn.get(node.id) === 0).map(node => node.id)

  // Walked while it grows, which an array iterator allows — it reads `length` on every turn. The
  // queue is never shifted, so the graph's own order is what makes two runs plan the same way.
  for (const id of ready) {
    const node = byId.get(id)
    if (!node) continue

    const feeding = incoming.get(id) ?? []
    const hash = hashOf(node, feeding, hashes)
    hashes.set(id, hash)
    order.push({
      id,
      hash,
      inputs: inputsOf(node, feeding, byId),
      awaits: [...(awaited.get(id) ?? [])],
      cached: cache?.has(hash) === true,
    })

    for (const edge of outgoing.get(id) ?? []) {
      const left = (waitingOn.get(edge.source) ?? 0) - 1
      waitingOn.set(edge.source, left)
      if (left === 0) ready.push(edge.source)
    }
  }

  if (order.length === graph.nodes.length) return { ok: true, order }

  return { ok: false, cycle: cycleAmong(graph, order, outgoing) }
}

/**
 * Which approvals stand between each node and what feeds it, keyed by that node.
 *
 * This is the rule the SDK's converter writes into the flow — everything reading a guarded node
 * gains a dependency on its approval — brought forward into the plan so the LOCAL run stops at
 * the same place a published one would. Left to the executor it would be a race: two consumers of
 * one guarded node are siblings in the topological order, and one of them could be handed its
 * inputs before the question had been asked.
 *
 * No approval waits on another, its own answer included. The converter never does: the flow items
 * it pushes for them carry `dependsOn: [approvedFlowId]` and nothing else. Without this, the wire
 * an approval names its node by reads as a dependency on its own answer — a loop — and two
 * approvals on one node would queue one behind the other, the second painted "upstream failed"
 * when the first was declined, though nothing failed and nobody asked it anything.
 */
function awaitedApprovals(
  graph: GraphState,
  edges: readonly GraphEdge[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const guards = approvalsOf(graph)
  if (guards.size === 0) return new Map()

  const approvals = new Set(
    graph.nodes.filter(node => node.type === 'approval').map(node => node.id),
  )
  const awaited = new Map<string, Set<string>>()

  for (const edge of edges) {
    const approval = guards.get(edge.target)
    if (approval === undefined || approvals.has(edge.source)) continue

    const held = awaited.get(edge.source)
    if (held) held.add(approval)
    else awaited.set(edge.source, new Set([approval]))
  }

  return awaited
}

/**
 * The nodes actually caught in a loop, which is not what Kahn leaves behind.
 *
 * What it leaves is everything the loop BLOCKS, and a node downstream of a cycle is innocent —
 * naming it would send the user to a node that is fine. Peeling the other way, dropping whatever
 * nothing left reads, ends on the loops themselves.
 */
function cycleAmong(
  graph: GraphState,
  order: readonly GraphPlanNode[],
  outgoing: ReadonlyMap<string, readonly GraphEdge[]>,
): readonly string[] {
  const placed = new Set(order.map(node => node.id))
  const stuck = new Set(graph.nodes.map(node => node.id).filter(id => !placed.has(id)))

  for (let peeled = true; peeled;) {
    peeled = false

    for (const id of [...stuck]) {
      if ((outgoing.get(id) ?? []).some(edge => stuck.has(edge.source))) continue
      stuck.delete(id)
      peeled = true
    }
  }

  return graph.nodes.map(node => node.id).filter(id => stuck.has(id))
}

function push(index: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void {
  const held = index.get(key)
  if (held) held.push(edge)
  else index.set(key, [edge])
}
