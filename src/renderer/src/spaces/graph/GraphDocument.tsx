import { useCallback, useEffect, useRef } from 'react'
import type { Connection } from '@xyflow/react'
import {
  connectGraph,
  disconnectGraph,
  moveGraphNode,
  removeGraphNode,
} from '@/engines/graph/commands'
import { graphOf, useGraphs } from '@/stores/graphs'
import { GraphCanvas } from './GraphCanvas'

/**
 * A graph, as a document: the canvas draws what the store holds, and every gesture comes back as
 * a command on the very history the five other spaces use (invariant 4). Nothing is held here.
 */
export function GraphDocument({ documentId }: { documentId: string }) {
  const graph = useGraphs(state => graphOf(state, documentId))
  const dragging = useRef(false)

  /**
   * A tab closed mid-drag would leave its gesture open for good: no further change ever reports
   * the pointer let go, and the store then coalesces every later edit of that document into the
   * entry the drag left behind — one ⌘Z undoing far more than the gesture that asked for it.
   */
  useEffect(
    () => () => {
      if (dragging.current) useGraphs.getState().endGesture(documentId)
    },
    [documentId],
  )

  /**
   * A drag is one undo entry. The gesture opens on the first frame and closes on the one that
   * reports the pointer let go — closing it per frame would fragment a single move into dozens.
   */
  const onMove = useCallback(
    (moves: ReadonlyMap<string, { x: number; y: number }>, settled: boolean) => {
      const store = useGraphs.getState()
      if (!dragging.current) {
        store.beginGesture(documentId)
        dragging.current = true
      }

      for (const [id, position] of moves) store.runCommand(documentId, moveGraphNode(id, position))

      if (settled) {
        store.endGesture(documentId)
        dragging.current = false
      }
    },
    [documentId],
  )

  const onRemoveNodes = useCallback(
    (ids: readonly string[]) => {
      const store = useGraphs.getState()
      // One entry for a selection deleted in one keystroke, however many nodes it held.
      store.beginGesture(documentId)
      for (const id of ids) store.runCommand(documentId, removeGraphNode(id))
      store.endGesture(documentId)
    },
    [documentId],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      useGraphs.getState().runCommand(documentId, connectGraph(connection))
    },
    [documentId],
  )

  const onDisconnect = useCallback(
    (edgeIds: readonly string[]) => {
      const store = useGraphs.getState()
      store.beginGesture(documentId)
      for (const id of edgeIds) store.runCommand(documentId, disconnectGraph(id))
      store.endGesture(documentId)
    },
    [documentId],
  )

  return (
    <GraphCanvas
      graph={graph}
      onMove={onMove}
      onRemoveNodes={onRemoveNodes}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
    />
  )
}
