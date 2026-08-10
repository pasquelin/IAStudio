import type { GraphEdge, GraphNode, GraphPosition, GraphState } from '@shared/domain/graph'
import type { Connection } from './connect'
import { edgeOf } from './connect'
import { inputHandlesOf, outputHandlesOf, takesManyWires } from './handles'

/**
 * The id the webapp gives a node: its type in camel case, then the smallest free number.
 *
 * Numbered per type rather than globally, because that is what the webapp writes and what makes
 * an id readable — `text1`, `imageGenerator1`. The number is not an index into anything: a graph
 * that loses `text1` keeps `text2`, and the next text node takes the hole rather than a third
 * name.
 */
export function nextNodeId(nodes: readonly GraphNode[], type: string): string {
  const taken = new Set(nodes.map(node => node.id))

  let index = 1
  while (taken.has(`${type}${index}`)) index += 1
  return `${type}${index}`
}

export function addNode(graph: GraphState, node: GraphNode): GraphState {
  return { ...graph, nodes: [...graph.nodes, node] }
}

export function moveNode(graph: GraphState, id: string, position: GraphPosition): GraphState {
  return {
    ...graph,
    nodes: graph.nodes.map(node => (node.id === id ? { ...node, position } : node)),
  }
}

/**
 * Removing a node takes its edges with it, and its place among the workflow's inputs.
 *
 * Left behind, an edge would name a node that no longer exists — which the validator rejects at
 * export, far from the gesture that caused it.
 */
export function removeNode(graph: GraphState, id: string): GraphState {
  return {
    ...graph,
    nodes: graph.nodes.filter(node => node.id !== id),
    edges: graph.edges.filter(edge => edge.source !== id && edge.target !== id),
    inputKeys: graph.inputKeys.filter(key => key !== id),
  }
}

/**
 * Connecting an input that already has a producer REPLACES it — unless the port takes several.
 *
 * The refusal in `refuseConnection` is what the canvas paints while the wire is being dragged;
 * this is what happens when the user drops it anyway. One producer per input where the compiler
 * would otherwise pick the first and drop the rest without a word, and as many as the user draws
 * where each one compiles to a variable of its own (`takesManyWires`).
 */
export function connect(graph: GraphState, connection: Connection): GraphState {
  const edge = edgeOf(connection)
  if (!edge) return graph

  const consumer = graph.nodes.find(node => node.id === edge.source)
  const joins = consumer !== undefined && takesManyWires(consumer)

  const kept = graph.edges.filter(existing =>
    joins
      ? existing.id !== edge.id
      : existing.source !== edge.source || existing.sourceHandle !== edge.sourceHandle,
  )

  return { ...graph, edges: [...kept, edge] }
}

export function disconnect(graph: GraphState, edgeId: string): GraphState {
  return { ...graph, edges: graph.edges.filter(edge => edge.id !== edgeId) }
}

/** Merges into what one node holds, leaving where it sits and what it is alone. */
function withData<N extends GraphNode>(node: N, patch: Partial<N['data']>): N {
  return { ...node, data: { ...node.data, ...patch } }
}

export function updateNodeData(
  graph: GraphState,
  id: string,
  patch: Partial<GraphNode['data']>,
): GraphState {
  return {
    ...graph,
    nodes: graph.nodes.map(node => (node.id === id ? withData(node, patch) : node)),
  }
}

/**
 * Swaps what a node holds AND the ports it is wired by, then cuts what those ports no longer
 * answer for.
 *
 * A generator's ports come from its model's own schema (invariant 5), so changing the model
 * changes the ports — and an edge aimed at one that is gone names a handle no node carries. That
 * is not a drawing problem: `validateWorkflowFlow` rejects it at export, far from the gesture
 * that caused it, and `removeNode` already takes this care for a node the same way.
 *
 * Only edges touching THIS node are examined: the rest of the graph is not the caller's business,
 * and walking it would make a model swap cost the whole edge list.
 *
 * And only the SIDE the patch redeclares. A branch gaining or losing a case rewrites its outputs
 * and says nothing about what feeds it — judged against input handles a file left undeclared, its
 * every incoming wire would be cut by an edit that never mentioned them.
 */
export function replaceNodePorts(
  graph: GraphState,
  id: string,
  patch: Partial<GraphNode['data']>,
): GraphState {
  const next = updateNodeData(graph, id, patch)
  const node = next.nodes.find(candidate => candidate.id === id)
  if (!node) return graph

  // The VALUE, not the key: a patch carrying `outputHandles: undefined` would pass an `in` test
  // and have every wire judged against a list the node no longer has.
  const inputs = patch.inputHandles === undefined ? undefined : idsOf(inputHandlesOf(node))
  const outputs = patch.outputHandles === undefined ? undefined : idsOf(outputHandlesOf(node))

  // Both ends of every edge, never the first that answers: an edge may touch this node twice, and
  // an `if/else` would keep one whose surviving end vouched for a departed one.
  const kept = next.edges.filter(edge => {
    // `source` is the CONSUMER and `target` the PROVIDER — Scenario's inverted convention.
    const feeds = edge.source !== id || edge.sourceHandle === undefined
    const reads = edge.target !== id || edge.targetHandle === undefined

    return (
      (feeds || inputs === undefined || inputs.has(edge.sourceHandle ?? '')) &&
      (reads || outputs === undefined || outputs.has(edge.targetHandle ?? ''))
    )
  })

  return kept.length === next.edges.length ? next : { ...next, edges: kept }
}

const idsOf = (handles: readonly { id: string }[]): ReadonlySet<string> =>
  new Set(handles.map(handle => handle.id))

/** The edges that feed a node, and the ones it feeds — the inverted convention, read both ways. */
export const providersOf = (graph: GraphState, id: string): readonly GraphEdge[] =>
  graph.edges.filter(edge => edge.source === id)

export const consumersOf = (graph: GraphState, id: string): readonly GraphEdge[] =>
  graph.edges.filter(edge => edge.target === id)
