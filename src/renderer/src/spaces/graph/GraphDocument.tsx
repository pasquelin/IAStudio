import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Connection } from '@xyflow/react'
import type { CommandId } from '@shared/domain/command'
import type { GraphPosition } from '@shared/domain/graph'
import {
  addGraphNode,
  connectGraph,
  disconnectGraph,
  moveGraphNode,
  removeGraphNode,
} from '@/engines/graph/commands'
import type { Asset } from '@shared/domain/asset'
import { assetNode, createModelNode, createNode } from '@/engines/graph/factory'
import { modelForScope } from '@/helpers/model-for-scope'
import { offerModelsOfFamily } from '@/helpers/offer-model'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import type { PaletteEntry } from './palette'
import { useDocuments } from '@/stores/documents'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { useSelection } from '@/stores/selection'
import { useShortcuts } from '@/hooks/useShortcuts'
import { GraphCanvas } from './GraphCanvas'

/**
 * A graph, as a document: the canvas draws what the store holds, and every gesture comes back as
 * a command on the very history the five other spaces use (invariant 4). Nothing is held here.
 */
export function GraphDocument({ documentId }: { documentId: string }) {
  const graph = useGraphs(state => graphOf(state, documentId))
  const active = useDocuments(state => state.activeId === documentId)
  const canUndo = useGraphs(state => historyOf(state, documentId).past.length > 0)
  const canRedo = useGraphs(state => historyOf(state, documentId).future.length > 0)
  /**
   * Held here, not in the global selection: that one carries a single kind at a time, so clicking
   * a thumbnail in the asset shelf — which shares this space's screen — would unhighlight the node
   * and leave Suppr with nothing to delete. Held in the canvas instead, it would not survive the
   * canvas being remounted. It is PUBLISHED below for the inspector to read, never owned there.
   */
  const [picked, setPicked] = useState<readonly string[]>([])
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

  /**
   * The graph is read back from the store rather than closed over: the callback outlives the
   * render it was made in, and naming a node after a graph one gesture old would hand out an id
   * a node already has.
   */
  const onAdd = useCallback(
    (entry: PaletteEntry, position: GraphPosition) => {
      if (entry.group === 'input') {
        const store = useGraphs.getState()
        return store.runCommand(
          documentId,
          addGraphNode(createNode(graphOf(store, documentId), entry.node, position)),
        )
      }

      // A generator lands on the model chosen for that family, and its ports come from that
      // model's own schema (invariant 5) — so the node cannot be built until the schema is in.
      const modelId = modelForScope(entry.family)
      // With no model to build one from, the answer is the panel where one is chosen, narrowed
      // to the family asked for: a graph browses every family, so nothing else would say which.
      if (!modelId) return offerModelsOfFamily(entry.family)

      void getBridge()
        ?.scenario.describeModel(modelId)
        .then(descriptor => {
          if (!descriptor) return
          const store = useGraphs.getState()
          store.runCommand(
            documentId,
            addGraphNode(
              createModelNode(
                graphOf(store, documentId),
                entry.family,
                modelId,
                descriptor.fields,
                position,
              ),
            ),
          )
        })
        .catch(error => reportFailure('graph.node', modelId, error))
    },
    [documentId],
  )

  /**
   * The keyboard this space would never have had. Its history is built with care above — a drag
   * is one entry, a deleted selection is one entry — but a workspace absent from
   * `SCOPE_BY_WORKSPACE` keeps the NATIVE undo, which registers the accelerator with the OS and
   * swallows it. Exactly what Skyboxes had to learn: the history worked, nothing listened.
   */
  /**
   * An asset let go over the canvas becomes the node that carries it, already filled — the
   * shelf offers every kind, and the node's port takes the kind it holds.
   */
  const onDropAsset = useCallback(
    (asset: Asset, position: GraphPosition) => {
      const store = useGraphs.getState()
      store.runCommand(
        documentId,
        addGraphNode(assetNode(graphOf(store, documentId), asset, position)),
      )
    },
    [documentId],
  )

  /**
   * Only ids the graph still holds. React Flow reports a deselection for a node it MOUNTED; a
   * node that left the graph while the panel was unmounted — an undone add, a tab reopened — is
   * never spoken of again, and its id would sit in the set for the rest of the session, making
   * every later pick read as two and the inspector describe none of them.
   */
  const live = useMemo(
    () => picked.filter(id => graph.nodes.some(node => node.id === id)),
    [picked, graph],
  )

  /** Published for the inspector to read; the truth stays above, out of a single-kind store. */
  useEffect(() => {
    useSelection.getState().selectNodes(documentId, live)
  }, [documentId, live])

  const onSelectNodes = useCallback((ids: readonly string[]) => setPicked(ids), [])

  const undo = useCallback(() => useGraphs.getState().undo(documentId), [documentId])
  const redo = useCallback(() => useGraphs.getState().redo(documentId), [documentId])

  const run = useCallback(
    (command: CommandId): void => {
      if (command === 'graph.undo') return undo()
      if (command === 'graph.redo') return redo()
    },
    [undo, redo],
  )

  useShortcuts({ scope: 'graph', enabled: active, onCommand: run })

  return (
    <GraphCanvas
      graph={graph}
      onMove={onMove}
      onRemoveNodes={onRemoveNodes}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onAdd={onAdd}
      onDropAsset={onDropAsset}
      selectedNodeIds={live}
      onSelectNodes={onSelectNodes}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
    />
  )
}
