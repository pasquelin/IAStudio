import type { GraphEdge, GraphNode, GraphPosition, GraphState } from '@shared/domain/graph'
import type { Connection } from './connect'
import { edgeOf } from './connect'

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
 * Connecting an input that already has a producer REPLACES it.
 *
 * The refusal in `refuseConnection` is what the canvas paints while the wire is being dragged;
 * this is what happens when the user drops it anyway. One producer per input either way — the
 * compiler would otherwise pick the first and drop the rest without a word.
 */
export function connect(graph: GraphState, connection: Connection): GraphState {
  const edge = edgeOf(connection)
  if (!edge) return graph

  const kept = graph.edges.filter(
    existing => existing.source !== edge.source || existing.sourceHandle !== edge.sourceHandle,
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

/** The edges that feed a node, and the ones it feeds — the inverted convention, read both ways. */
export const providersOf = (graph: GraphState, id: string): readonly GraphEdge[] =>
  graph.edges.filter(edge => edge.source === id)

export const consumersOf = (graph: GraphState, id: string): readonly GraphEdge[] =>
  graph.edges.filter(edge => edge.target === id)
