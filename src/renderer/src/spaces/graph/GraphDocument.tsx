import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Connection } from '@xyflow/react'
import type { CommandId } from '@shared/domain/command'
import type { GraphPublishResult, GraphState } from '@shared/domain/graph'
import { isRunnable, type GraphPosition } from '@shared/domain/graph'
import {
  addGraphNode,
  replaceGraph,
  connectGraph,
  disconnectGraph,
  moveGraphNode,
  removeGraphNode,
} from '@/engines/graph/commands'
import type { Asset } from '@shared/domain/asset'
import { assetNode, createModelNode, createNode } from '@/engines/graph/factory'
import { parseGraph } from '@/engines/graph/serialize'
import { modelForScope } from '@/helpers/model-for-scope'
import { offerModelsOfFamily } from '@/helpers/offer-model'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import type { PaletteEntry } from './palette'
import { useDocuments } from '@/stores/documents'
import { runOf, useGraphRuns } from '@/stores/graph-runs'
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
  const canRun = useGraphs(state => isRunnable(graphOf(state, documentId)))
  const title = useDocuments(state => state.documents[documentId]?.title ?? '')
  // `workflow_create` refuses empty `nodes`/`edges`, so an empty graph writes a file the webapp
  // would not take back.
  const canExport = graph.nodes.length > 0
  // Held here rather than in the bar: a write on the account must leave a mark on the screen, and
  // the canvas already has the one line that says what the graph would export.
  /**
   * The publication's verdict, WITH the graph it was given — so it can be dropped by derivation
   * rather than by an effect writing state, which the lint refuses and rightly.
   *
   * Dropping it matters more since a refusal paints nodes: kept across an edit, it would point at
   * a graph the user has already changed, and the status line would name a verdict long dead.
   */
  const [published, setPublished] = useState<{
    of: GraphState
    result: GraphPublishResult
  } | null>(null)
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

  const running = useGraphRuns(state => runOf(state, documentId).running)
  const runs = useGraphRuns(state => runOf(state, documentId).nodes)

  /** One button for the pair, so what it does is read off what the graph is doing right now. */
  const onRun = useCallback(() => {
    const store = useGraphRuns.getState()
    if (runOf(store, documentId).running) return store.stop(documentId)
    // Reported rather than swallowed: a run that cannot even be planned — a `.graph` whose
    // handles are not a list, a chunk that failed to load — would otherwise be a button that
    // does nothing at all, with nothing anywhere saying why.
    void store.start(documentId).catch(error => reportFailure('graph.run', documentId, error))
  }, [documentId])

  /**
   * The graph as a file, which the main process writes: the renderer has no filesystem, and the
   * picker it opens is a native one. Nothing is painted on the way back — a closed picker is not
   * a failure, and a written file is a file the user just named.
   */
  const onExport = useCallback(() => {
    void getBridge()
      ?.workflows.export(graph, title)
      .catch(error => reportFailure('graph.export', documentId, error))
  }, [documentId, graph, title])

  /**
   * The graph as an App of the account. Nothing is painted on the way back yet — the code the
   * publication answers with is the compile's own vocabulary, and where it goes on the screen is
   * the same question the compile already asks; the journal carries the API's sentence meanwhile.
   */
  const onPublish = useCallback(() => {
    setPublished(null)
    void getBridge()
      ?.workflows.publish(graph, title)
      .then(result => setPublished({ of: graph, result }))
      .catch(error => reportFailure('graph.publish', documentId, error))
  }, [documentId, graph, title])

  /**
   * A graph off a file, put in place of this one — through a COMMAND, so `⌘Z` gives back what was
   * there. An import lands on top of work somebody may not have meant to lose.
   *
   * A file that holds no graph reads as an empty one, and replacing a canvas with nothing is not
   * what anyone asked for: nothing is applied then, and the journal says why.
   */
  const onImport = useCallback(() => {
    void getBridge()
      ?.workflows.import()
      .then(raw => {
        if (raw === null) return

        const read = parseGraph(raw)
        if (read.nodes.length === 0) {
          return reportFailure('graph.import', documentId, new Error('no node in that file'))
        }

        // The run state is keyed by NODE ID and outlives the graph: ids are `text1`,
        // `imageGenerator1` — the webapp's convention and ours — so an imported node would wear
        // the previous graph's result without ever having run. `⌘Z` cannot help: a run is not in
        // the history.
        useGraphRuns.getState().forget(documentId)
        useGraphs.getState().runCommand(documentId, replaceGraph(read))
      })
      .catch(error => reportFailure('graph.import', documentId, error))
  }, [documentId])

  const onDecide = useCallback(
    (nodeId: string, approved: boolean) =>
      useGraphRuns.getState().decide(documentId, nodeId, approved),
    [documentId],
  )

  const run = useCallback(
    (command: CommandId): void => {
      if (command === 'graph.run') return onRun()
      if (command === 'graph.undo') return undo()
      if (command === 'graph.redo') return redo()
    },
    [onRun, undo, redo],
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
      onRun={onRun}
      onDecide={onDecide}
      canUndo={canUndo}
      canRedo={canRedo}
      canRun={canRun}
      canExport={canExport}
      onExport={onExport}
      onPublish={onPublish}
      onImport={onImport}
      canImport={!running}
      published={published?.of === graph ? published.result : null}
      runs={runs}
      running={running}
    />
  )
}
