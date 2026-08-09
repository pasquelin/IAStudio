import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Connection as CanvasConnection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
} from '@xyflow/react'
import type { GraphState } from '@shared/domain/graph'
import { canDropConnection } from '@/engines/graph/connect'
import {
  canvasNodesOf,
  isDragging,
  movesIn,
  removalsIn,
  selectionAfter,
  toCanvasEdges,
} from './adapter'
import { GRAPH_NODE_TYPES } from './GraphNodes'

/**
 * What the canvas asks of whoever owns the graph. It owns nothing itself — the state comes down,
 * the gestures go up, and the engine holds the truth (invariant 4).
 */
export type GraphCanvasProps = {
  graph: GraphState
  onMove: (moves: ReadonlyMap<string, { x: number; y: number }>, settled: boolean) => void
  onRemoveNodes: (ids: readonly string[]) => void
  onConnect: (connection: CanvasConnection) => void
  onDisconnect: (edgeIds: readonly string[]) => void
}

/** The webapp's own background: dots, gap 20, size 0.5 — read off `app.scenario.com`. */
const DOT_GAP = 20
const DOT_SIZE = 0.5

export function GraphCanvas({
  graph,
  onMove,
  onRemoveNodes,
  onConnect,
  onDisconnect,
}: GraphCanvasProps) {
  /**
   * Session state, and the canvas is where it belongs: nothing about which node is selected
   * survives a save, and a graph that reopened selected would say the file remembered a click.
   */
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const nodes = useMemo(() => canvasNodesOf(graph, selected), [graph, selected])
  const edges = useMemo(() => toCanvasEdges(graph, selected), [graph, selected])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setSelected(current => selectionAfter(current, changes))

      const removed = removalsIn(changes)
      if (removed.length > 0) onRemoveNodes(removed)

      const moves = movesIn(changes)
      if (moves.size > 0) onMove(moves, !isDragging(changes))
    },
    [onMove, onRemoveNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setSelected(current => selectionAfter(current, changes))

      const removed = changes.filter(change => change.type === 'remove').map(change => change.id)
      if (removed.length > 0) onDisconnect(removed)
    },
    [onDisconnect],
  )

  /**
   * Asked while a wire is being dragged, on every candidate port under the pointer, and again
   * before `onConnect` fires — so it answers what may be DROPPED, which lets a wired input be
   * rewired. The rule itself is the engine's; the canvas only asks.
   */
  const isValidConnection: IsValidConnection = useCallback(
    connection => canDropConnection(graph, connection),
    [graph],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={GRAPH_NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      // Neither `<Controls>` nor `<MiniMap>`: the studio has its own toolbar, and the webapp
      // shows neither either. `<Background>` is the one piece of their chrome worth keeping.
      proOptions={{ hideAttribution: false }}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} gap={DOT_GAP} size={DOT_SIZE} />
    </ReactFlow>
  )
}
