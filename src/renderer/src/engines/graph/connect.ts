import type { GraphEdge, GraphState } from '@shared/domain/graph'
import { takesManyWires } from '@shared/domain/graph'
import { edgeId, inputHandleOf, outputHandleOf, typesConnect } from './handles'

/**
 * A connection as the canvas hands it over, before the studio has decided anything about it.
 *
 * Named after Scenario's convention and not after the gesture: `source` is the CONSUMER — the
 * node whose input is being fed — and `target` the PROVIDER. See `GraphEdge`.
 */
export type Connection = {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type Refusal =
  | 'unknown-node'
  | 'unknown-handle'
  | 'same-node'
  | 'type-mismatch'
  | 'input-taken'
  | 'already-connected'

/**
 * Why a connection cannot be made, or `null` when it can.
 *
 * A reason rather than a boolean: the canvas paints the refusal, and "this port is already fed"
 * and "these two types do not meet" are not the same message. `isValidConnection` reads it as a
 * boolean; the tooltip reads the reason.
 */
export function refuseConnection(graph: GraphState, connection: Connection): Refusal | null {
  const { source, target, sourceHandle, targetHandle } = connection
  if (source === target) return 'same-node'

  const consumer = graph.nodes.find(node => node.id === source)
  const provider = graph.nodes.find(node => node.id === target)
  if (!consumer || !provider) return 'unknown-node'

  if (!sourceHandle || !targetHandle) return 'unknown-handle'

  const input = inputHandleOf(consumer, sourceHandle)
  const output = outputHandleOf(provider, targetHandle)
  if (!input || !output) return 'unknown-handle'

  if (!typesConnect(output, input)) return 'type-mismatch'

  // Keyed by the node AND the handle, like `connect` is: handle ids carry their node id by
  // Scenario's convention, but nothing read from a file is made to honour it.
  const feeding = graph.edges.filter(
    edge => edge.source === source && edge.sourceHandle === sourceHandle,
  )
  if (feeding.some(edge => edge.targetHandle === targetHandle)) return 'already-connected'

  // One producer per input, unless the node names its wires after their provider: there a second
  // one is a second CEL variable. Elsewhere the compiler would pick the first and drop the rest,
  // so replacing the edge is the editor's job — refusing here is what makes that visible.
  return feeding.length > 0 && !takesManyWires(consumer.type, input.name) ? 'input-taken' : null
}

export const canConnect = (graph: GraphState, connection: Connection): boolean =>
  refuseConnection(graph, connection) === null

/**
 * What the canvas may DROP, which is not what it may connect: an input that already has a
 * producer accepts a new wire, and the old one goes.
 *
 * The two answers have to differ, because the canvas asks this one before it will even call
 * `onConnect`. Answering `false` on `input-taken` made rewiring an input impossible with the
 * mouse — the wire simply sprang back — while `connect` sat there able to replace it, proved by
 * a test that no gesture could reach.
 */
export const canDropConnection = (graph: GraphState, connection: Connection): boolean => {
  const refusal = refuseConnection(graph, connection)
  return refusal === null || refusal === 'input-taken'
}

/**
 * The edge every gesture of the editor builds — the canvas through `edgeOf`, a fixture through
 * `wire`. Only `parseEdge` builds one elsewhere, off a file, where the ends are already written.
 *
 * Ports come in as HANDLE IDS rather than field names, so a document naming its own ports goes
 * through here too. See `GraphEdge` for why `source` is the CONSUMER.
 */
export const edgeBetween = (
  consumer: string,
  sourceHandle: string,
  provider: string,
  targetHandle: string,
): GraphEdge => ({
  id: edgeId(targetHandle, sourceHandle),
  source: consumer,
  target: provider,
  sourceHandle,
  targetHandle,
})

/** The edge a connection becomes, or nothing where the canvas hands over an end it never drew. */
export function edgeOf(connection: Connection): GraphEdge | null {
  const { source, target, sourceHandle, targetHandle } = connection
  if (!sourceHandle || !targetHandle) return null

  return edgeBetween(source, sourceHandle, target, targetHandle)
}
