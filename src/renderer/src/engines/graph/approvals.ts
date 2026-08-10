import type { GraphState } from '@shared/domain/graph'
import { APPROVAL_PORT } from '@shared/domain/graph'
import { handleId } from './handles'

/**
 * Which approval node guards which node, keyed by the node being guarded.
 *
 * Transcribed from the SDK's own `workflow_converter.js` rather than reasoned out, because the
 * studio and the export must agree on what an approval covers: it reads the FIRST edge leaving an
 * approval through `` `${id}-source-approval` ``, and when two approvals name the same node the
 * LAST one in the node order wins. Both are its behaviour, not a preference of ours — matching
 * them is what makes a graph run here the way it would run once published.
 *
 * The edge points from the approval to the node it guards, which reads backwards and is the
 * convention everywhere else in this format: `source` is the consumer — see `GraphEdge`.
 */
export function approvalsOf(graph: GraphState): ReadonlyMap<string, string> {
  const guards = new Map<string, string>()
  const held = new Set(graph.nodes.map(node => node.id))

  for (const node of graph.nodes) {
    if (node.type !== 'approval') continue

    const wire = graph.edges.find(
      edge =>
        edge.source === node.id && edge.sourceHandle === handleId(node.id, 'source', APPROVAL_PORT),
    )

    // An approval wired to nothing — or to a node a file names and the graph no longer holds —
    // guards nothing: the converter drops it, so the studio must not stop on it either. That it
    // asks nothing is the executor's half, which reads this very map.
    if (wire && held.has(wire.target)) guards.set(wire.target, node.id)
  }

  return guards
}
