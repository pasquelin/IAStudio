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

  for (const node of graph.nodes) {
    if (node.type !== 'approval') continue

    const wire = graph.edges.find(
      edge =>
        edge.source === node.id && edge.sourceHandle === handleId(node.id, 'source', APPROVAL_PORT),
    )

    // An approval wired to nothing guards nothing: it compiles away, and a run must not stop on
    // a question about a node the user never named.
    if (wire) guards.set(wire.target, node.id)
  }

  return guards
}
