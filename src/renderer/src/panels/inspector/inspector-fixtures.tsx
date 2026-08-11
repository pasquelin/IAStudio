import { nodeIn } from '@/stores/graph-fixtures'
import { useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

/**
 * The node inspector as `Inspector` mounts it: SUBSCRIBED to the store rather than handed a
 * frozen node. Handed one, every field reads the value it opened on however many keystrokes it
 * took — so a test typing one character passes while the second character overwrites the first.
 *
 * Here on the precedent of `spaces/graph/graph-canvas-fixtures.ts`: a fixture of a surface lives
 * with that surface. `stores/graph-fixtures.ts` would work — `stores/models.ts` reaches into
 * `panels/` in production — but nothing there stands up a panel, and this does nothing else.
 *
 * It renders NOTHING for an id the graph does not hold, where `Inspector.tsx:139` renders
 * `<Empty />`. The two differ, deliberately: an empty state under test is a thing to assert
 * around. No suite reaches that branch today — only this file's own test does.
 */
export function LiveNodeInspector({ documentId, id }: { documentId: string; id: string }) {
  const node = useGraphs(state => nodeIn(state, documentId, id))

  return node ? <GraphNodeInspector documentId={documentId} node={node} /> : null
}
