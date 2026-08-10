import type { GraphNode, GraphPosition, GraphState } from '@shared/domain/graph'
import type { Command } from '../core/history'
import type { Connection } from './connect'
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNode,
  replaceNodePorts,
  updateNodeData,
} from './mutations'

/**
 * Graph edits, on the very history the other five spaces use.
 *
 * Each captures what it needs to revert **as it is applied** rather than as it is built, so a
 * command survives being redone — the rule the scene and skybox commands were written to.
 *
 * The whole previous state is captured rather than a delta. A graph is small, its edits touch
 * several lists at once (removing a node takes its edges and its input key), and a hand-written
 * inverse for each of those is where an undo history starts lying.
 */
function reversible(id: string, next: (graph: GraphState) => GraphState): Command<GraphState> {
  let before: GraphState | undefined

  return {
    id,
    apply: graph => {
      before = graph
      return next(graph)
    },
    revert: graph => before ?? graph,
  }
}

export const addGraphNode = (node: GraphNode): Command<GraphState> =>
  reversible(`graph:add:${node.id}`, graph => addNode(graph, node))

export const removeGraphNode = (id: string): Command<GraphState> =>
  reversible(`graph:remove:${id}`, graph => removeNode(graph, id))

/**
 * One id for the whole drag: every frame of it carries the same one and collapses into a single
 * undo entry, while moving another node starts its own.
 */
export const moveGraphNode = (id: string, position: GraphPosition): Command<GraphState> =>
  reversible(`graph:move:${id}`, graph => moveNode(graph, id, position))

export const connectGraph = (connection: Connection): Command<GraphState> =>
  reversible(`graph:connect:${connection.source}:${connection.sourceHandle ?? ''}`, graph =>
    connect(graph, connection),
  )

export const disconnectGraph = (edgeId: string): Command<GraphState> =>
  reversible(`graph:disconnect:${edgeId}`, graph => disconnect(graph, edgeId))

/**
 * Typing in a node coalesces per node and per field: a whole sentence is one undo entry, and
 * moving to another field starts the next.
 */
export const setGraphNodeData = (
  id: string,
  patch: Partial<GraphNode['data']>,
): Command<GraphState> =>
  reversible(`graph:data:${id}:${Object.keys(patch).sort().join(',')}`, graph =>
    updateNodeData(graph, id, patch),
  )

/**
 * What a node holds AND the ports it is wired by, in one entry — then the wires those ports no
 * longer answer for are cut.
 *
 * One command for the two gestures that move both at once: swapping a generator's model, whose
 * ports come from its schema (invariant 5), and adding or dropping a branch of an `ifElse`, whose
 * ports ARE its blocks — the converter reads the port at index `i` as case `i + 2`. Given back
 * apart by an undo, either would leave a node the compiler reads differently from the panel.
 *
 * The id is derived from the patch's own keys, as `setGraphNodeData` derives its own: two gestures
 * touching different fields never coalesce, so a model swap and a branch never merge into one ⌘Z.
 */
export const setGraphNodePorts = (
  id: string,
  patch: Partial<GraphNode['data']>,
): Command<GraphState> =>
  reversible(`graph:ports:${id}:${Object.keys(patch).sort().join(',')}`, graph =>
    replaceNodePorts(graph, id, patch),
  )
