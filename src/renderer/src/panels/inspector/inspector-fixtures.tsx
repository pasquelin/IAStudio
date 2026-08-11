import { nodeById } from '@shared/domain/graph'
import { graphOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

/**
 * The node inspector as `Inspector` mounts it: SUBSCRIBED to the store rather than handed a
 * frozen node. Handed one, every field reads the value it opened on however many keystrokes it
 * took — so a test typing one character passes while the second character overwrites the first.
 *
 * Here rather than in `stores/graph-fixtures.ts`, on the precedent of `home/home-fixtures.ts`:
 * a fixture lives with the surface it stands up, and a store fixture that renders a panel would
 * point the dependency the wrong way.
 *
 * Rendering nothing for an id the graph does not hold is what the panel itself does, and three
 * suites lean on it to assert that a node stopped being what they installed.
 */
export function LiveNodeInspector({ documentId, id }: { documentId: string; id: string }) {
  const node = useGraphs(state => nodeById(graphOf(state, documentId), id))

  return node ? <GraphNodeInspector documentId={documentId} node={node} /> : null
}
