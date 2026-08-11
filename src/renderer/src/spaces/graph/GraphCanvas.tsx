import { useCallback, useMemo, useRef, useState } from 'react'
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
import type {
  GraphNodeRun,
  GraphPosition,
  GraphState,
  GraphPublishResult,
} from '@shared/domain/graph'
import { canDropConnection } from '@/engines/graph/connect'
import type { PaletteEntry } from './palette'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { ASSET_TYPES, type Asset } from '@shared/domain/asset'
import {
  canvasNodesOf,
  isDragging,
  movesIn,
  removalsIn,
  selectionAfter,
  toCanvasEdges,
} from './adapter'
import { GRAPH_NODE_TYPES } from './GraphNodes'
import { GraphMenu } from './GraphMenu'
import { GraphStatus, shownVerdict, useGraphCompile } from './GraphStatus'
import { GraphToolbar } from './GraphToolbar'
import { NodeDecisionProvider } from './node-decision'
import { ViewportBridge } from './ViewportBridge'
import type { GraphMode } from './graph-tools'

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
  onAdd: (entry: PaletteEntry, position: GraphPosition) => void
  /** An asset let go over the canvas, with the point in the graph it was dropped at. */
  onDropAsset: (asset: Asset, position: GraphPosition) => void
  /**
   * The nodes picked, held above because the inspector reads them too — see `adapter.ts` for why
   * they must come back down. Edges stay below: lifting them waits on `Selection` holding more
   * than one kind at a time.
   */
  selectedNodeIds: readonly string[]
  onSelectNodes: (ids: readonly string[]) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Whether a run would report anything — the bar greys the button when it would not. */
  canRun: boolean
  canExport: boolean
  canImport: boolean
  /** What each node is doing in the run under way, or in the last one. Absent means idle. */
  runs: Readonly<Record<string, GraphNodeRun>>
  running: boolean
  /** Runs the graph, or stops the run — the bar draws whichever of the two applies. */
  onRun: () => void
  onExport: () => void
  onPublish: () => void
  onImport: () => void
  /** The last publication's outcome, painted over the compile line until the next attempt. */
  published: GraphPublishResult | null
  /** The answer given to an approval node the run has stopped on. */
  onDecide: (nodeId: string, approved: boolean) => void
}

/**
 * The webapp's own spacing, and NOT its dot size. `app.scenario.com` draws them at 0.5, which is
 * a radius of a quarter pixel: on their light canvas it reads, on our `panel` it is one grey on
 * another and the pane looks unpainted — checked on screen, where it was simply black.
 */
const DOT_GAP = 20
const DOT_SIZE = 2

/**
 * The initial fit never zooms IN. React Flow runs it when the first node arrives, not only at
 * mount, so dropping one node onto an empty graph jumped the canvas to 200 % — and the next node
 * was then placed in a frame the hand had not chosen.
 */
const FIT_VIEW = { maxZoom: 1 }

export function GraphCanvas({
  graph,
  onMove,
  onRemoveNodes,
  onConnect,
  onDisconnect,
  onAdd,
  onDropAsset,
  selectedNodeIds,
  onSelectNodes,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  canRun,
  canExport,
  canImport,
  runs,
  running,
  onRun,
  onExport,
  onPublish,
  onImport,
  published,
  onDecide,
}: GraphCanvasProps) {
  /** An edge has no inspector face, so which one is picked never leaves this surface. */
  const [selectedEdges, setSelectedEdges] = useState<ReadonlySet<string>>(() => new Set())

  const selectedNodes = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])

  /**
   * Where the add menu was asked for, in viewport coordinates. Kept unconverted: the pane
   * handler sits above React Flow's provider, so `screenToFlowPosition` is out of reach here —
   * the menu itself does the conversion, from inside.
   */
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  /** What the pointer does on the pane. Session state, like the selection beside it. */
  const [mode, setMode] = useState<GraphMode>('select')

  /**
   * The viewport's own converter, published by a child because only a child is under React
   * Flow's provider. A drop reports a screen point and the graph works in its own coordinates;
   * without this an asset would land wherever the last one did, however far the canvas has been
   * panned.
   */
  const toFlow = useRef<((at: { x: number; y: number }) => GraphPosition) | null>(null)

  /** Where the pointer was on the last `dragover` — a `drop` reports the point, the target does not. */
  const dropAt = useRef({ x: 0, y: 0 })

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    // The OS menu says nothing about a graph, and it would cover the one we do have to offer.
    event.preventDefault()
    setMenuAt({ x: event.clientX, y: event.clientY })
  }, [])

  const compiled = useGraphCompile(graph)

  // Painted from the verdict the STATUS LINE is showing — its own rule, asked rather than
  // repeated: a set of nodes ringed under a sentence that is not about them is the one failure
  // this whole lot exists to prevent.
  const shown = shownVerdict(compiled, published)

  // A new Set per verdict, never per frame: `canvasNodesOf` hands a node back by reference when
  // nothing about it moved, and a fresh Set on every render would defeat that.
  const problems = useMemo(() => new Set(shown && !shown.ok ? shown.nodes : []), [shown])

  const nodes = useMemo(
    () => canvasNodesOf(graph, selectedNodes, runs, problems),
    [graph, selectedNodes, runs, problems],
  )
  const edges = useMemo(() => toCanvasEdges(graph, selectedEdges), [graph, selectedEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Reported only when it actually moved: every frame of a drag is a batch of changes, and
      // `selectionAfter` hands the very same set back when none of them touched the selection.
      const next = selectionAfter(selectedNodes, changes)
      if (next !== selectedNodes) onSelectNodes([...next])

      const removed = removalsIn(changes)
      if (removed.length > 0) onRemoveNodes(removed)

      const moves = movesIn(changes)
      if (moves.size > 0) onMove(moves, !isDragging(changes))
    },
    [onMove, onRemoveNodes, onSelectNodes, selectedNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setSelectedEdges(current => selectionAfter(current, changes))

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
    // Everything, as the shelf below it offers: a node takes whatever the node before it made.
    <AssetDropTarget
      accepts={ASSET_TYPES}
      className="size-full"
      onDrop={asset => onDropAsset(asset, toFlow.current?.(dropAt.current) ?? { x: 0, y: 0 })}
    >
      {/* Ours rather than a prop on the shared target: only this surface needs the point, and a
          `dragover` bubbles up from the pane to here. */}
      <div
        className="size-full"
        onDragOver={event => {
          dropAt.current = { x: event.clientX, y: event.clientY }
        }}
      >
        {/* Above React Flow, which is what renders the nodes — and holding a value the caller
            keeps stable, or every node on the canvas re-renders when one of them is asked. */}
        <NodeDecisionProvider onDecide={onDecide}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={GRAPH_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onPaneContextMenu={onPaneContextMenu}
            // In pan mode the drag pushes the view; in select mode it draws a rubber band, which is
            // what the pointer tool means everywhere else in the studio.
            panOnDrag={mode === 'pan'}
            selectionOnDrag={mode === 'select'}
            // Neither `<Controls>` nor `<MiniMap>`: the studio has its own toolbar, and the webapp
            // shows neither either. `<Background>` is the one piece of their chrome worth keeping.
            proOptions={{ hideAttribution: false }}
            fitView
            fitViewOptions={FIT_VIEW}
          >
            <Background variant={BackgroundVariant.Dots} gap={DOT_GAP} size={DOT_SIZE} />
            <GraphToolbar
              mode={mode}
              onMode={setMode}
              // The bar's own button opens the same menu the right-click does; the bar says where.
              onAdd={setMenuAt}
              onUndo={onUndo}
              onRedo={onRedo}
              onRun={onRun}
              onExport={onExport}
              onPublish={onPublish}
              onImport={onImport}
              canUndo={canUndo}
              canRedo={canRedo}
              canRun={canRun}
              canExport={canExport}
              canImport={canImport}
              running={running}
            />
            <ViewportBridge
              onReady={useCallback((convert: (at: { x: number; y: number }) => GraphPosition) => {
                toFlow.current = convert
              }, [])}
            />
            {menuAt && <GraphMenu at={menuAt} onClose={() => setMenuAt(null)} onAdd={onAdd} />}
            <GraphStatus result={compiled} published={published} />
          </ReactFlow>
        </NodeDecisionProvider>
      </div>
    </AssetDropTarget>
  )
}
