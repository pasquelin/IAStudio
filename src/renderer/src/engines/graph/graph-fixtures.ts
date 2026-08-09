import type { GraphNode } from '@shared/domain/graph'
import { DEFAULT_OUTPUT_NAME, handleId } from './handles'

/**
 * A text node with the one port it is wired by, for the suites whose subject is not the port
 * itself. Declared once so a new required field on `GraphNode` breaks in one place.
 *
 * The tests that DO make ports their subject — polymorphic inputs, mismatched types — keep
 * writing their own: there, the handles are what is being read.
 */
export function textNode(id: string): GraphNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: {
      outputHandles: [
        { id: handleId(id, 'target', 'output'), name: DEFAULT_OUTPUT_NAME, type: 'prompt' },
      ],
    },
  }
}
