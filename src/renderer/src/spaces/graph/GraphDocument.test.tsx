import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import type { FieldDescriptor, ModelDescriptor } from '@shared/domain/model'
import { addGraphNode, connectGraph } from '@/engines/graph/commands'
import { DEFAULT_COLLECTION_STATE, selectedValues } from '@/helpers/collection-state'
import { FAMILY_FACET } from '@/panels/models/family-facet'
import { installFakeBridge } from '@/services/fake-bridge'
import { useGraphRuns } from '@/stores/graph-runs'
import { graphOf, useGraphs } from '@/stores/graphs'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSelection } from '@/stores/selection'
import { useSettings } from '@/stores/settings'
import { preferModels } from '@/stores/settings-fixtures'
import { arrangedFor } from '@/stores/tool-fixtures'
import { arrangementOf, useTools } from '@/stores/tools'
import { GraphDocument } from './GraphDocument'
import { canvasNode, clickNode } from './graph-canvas-fixtures'

const DOCUMENT = 'graph_1'

const text: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: {
    value: 'a small grey rock',
    outputHandles: [{ id: 'text1-target-prompt', name: 'output', type: 'text' }],
  },
}

const model: GraphNode = {
  id: 'model1',
  type: 'model',
  position: { x: 400, y: 0 },
  data: {
    modelId: 'model_flux',
    inputHandles: [{ id: 'model1-source-prompt', label: 'Prompt', type: 'prompt' }],
  },
}

const wire = {
  source: 'model1',
  sourceHandle: 'model1-source-prompt',
  target: 'text1',
  targetHandle: 'text1-target-prompt',
}

const state = (): GraphState => graphOf(useGraphs.getState(), DOCUMENT)

const FIELDS: FieldDescriptor[] = [
  { key: 'prompt', kind: 'longText', label: 'Prompt', required: false, promptSpark: true },
]

const descriptor = (id: string, family: ModelDescriptor['family']): ModelDescriptor => ({
  id,
  name: id,
  family,
  source: 'scenario',
  origin: 'official',
  featured: false,
  capabilities: [],
  tags: [],
  fields: FIELDS,
})

beforeEach(() => {
  useGraphs.setState({ states: {}, histories: {}, saved: {} })
  useModels.setState({ selected: {}, preset: {}, collection: DEFAULT_COLLECTION_STATE })
  useSettings.setState(current => ({
    settings: {
      ...current.settings,
      generation: { ...current.settings.generation, defaultModels: {} },
    },
  }))
  useTools.setState({ arrangements: arrangedFor('graph', { open: {} }), focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'graph', home: false })
  useSelection.getState().clear()
  // Restored by hand, and named: one test below swaps `decide` for a spy, and a store action
  // left replaced would silently follow the suite into every file that shares this module.
  useGraphRuns.setState({ runs: {}, decide: REAL_DECIDE })
})

/** The store's own answer, kept before any test can replace it. */
const REAL_DECIDE = useGraphRuns.getState().decide

describe('a graph as a document', () => {
  it('draws what the store holds', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))

    render(<GraphDocument documentId={DOCUMENT} />)

    expect(screen.getByText('a small grey rock')).toBeInTheDocument()
    expect(screen.getByText('model_flux')).toBeInTheDocument()
  })

  /**
   * The end of the milestone, spelled as a test: three nodes, a wire, and ⌘Z gives the wire
   * back. The undo is the shared history — no store of its own was written for the graph.
   */
  it('undoes an edge without undoing the nodes it joined', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))
    store.runCommand(DOCUMENT, connectGraph(wire))

    expect(state().edges).toHaveLength(1)

    store.undo(DOCUMENT)

    expect(state().edges).toEqual([])
    expect(state().nodes).toHaveLength(2)
  })

  it('redoes what it just undid', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))
    store.runCommand(DOCUMENT, connectGraph(wire))
    store.undo(DOCUMENT)
    store.redo(DOCUMENT)

    expect(state().edges).toHaveLength(1)
    expect(state().edges[0]?.source).toBe('model1')
  })

  /**
   * A graph browses every family, so it files its own choice under `'all'` — and a generator
   * node asks for the model of ONE family. Reading the session choice alone left every family
   * the user had never visited elsewhere with nothing, and the studio answered with a failure in
   * the log: three of the four entries of its own palette could not be used at all.
   */
  describe('putting down a generator', () => {
    const chooseGenerator = (name: string): void => {
      const { container } = render(<GraphDocument documentId={DOCUMENT} />)
      const pane = container.querySelector('.react-flow__pane')
      if (!pane) throw new Error('no pane to right-click')

      fireEvent.contextMenu(pane, { clientX: 120, clientY: 40 })
      fireEvent.click(screen.getByRole('menuitem', { name }))
    }

    it('falls back to the model the preferences name for that family', async () => {
      const describeModel = vi.fn(() => Promise.resolve(descriptor('model_kling', 'video')))
      installFakeBridge({ scenario: { describeModel } })
      preferModels({ video: 'model_kling' })

      chooseGenerator('Vidéo')

      await waitFor(() => expect(state().nodes).toHaveLength(1))
      expect(describeModel).toHaveBeenCalledWith('model_kling')
      expect(state().nodes[0]?.id).toBe('videoGenerator1')
    })

    /** The session choice still wins: a preference is where to start, not what was decided. */
    it('prefers the model chosen for that family over the preference', async () => {
      const describeModel = vi.fn(() => Promise.resolve(descriptor('model_wan', 'video')))
      installFakeBridge({ scenario: { describeModel } })
      preferModels({ video: 'model_kling' })
      useModels.setState({ selected: { video: 'model_wan' } })

      chooseGenerator('Vidéo')

      await waitFor(() => expect(describeModel).toHaveBeenCalledWith('model_wan'))
    })

    /**
     * With no model anywhere, the answer is the panel where one is chosen — narrowed to the
     * family asked for, since a graph browses them all and nothing else would say which.
     */
    it('opens the model browser on that family when there is no model at all', () => {
      installFakeBridge()

      chooseGenerator('Audio')

      expect(arrangementOf(useTools.getState(), 'graph').open.left?.primary).toBe('models')
      expect(selectedValues(useModels.getState().collection, FAMILY_FACET)).toEqual(['audio'])
      // The node itself must not land half-built: its ports come from a schema there is none of.
      expect(state().nodes).toEqual([])
    })
  })

  /** A drag is one thing the user did, whatever number of frames it took. */
  it('collapses a whole drag into one undo entry', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))

    store.beginGesture(DOCUMENT)
    store.runCommand(DOCUMENT, { id: 'graph:move:text1', apply: moveTo(10), revert: moveTo(0) })
    store.runCommand(DOCUMENT, { id: 'graph:move:text1', apply: moveTo(90), revert: moveTo(0) })
    store.endGesture(DOCUMENT)

    expect(state().nodes[0]?.position.x).toBe(90)

    store.undo(DOCUMENT)
    expect(state().nodes[0]?.position.x).toBe(0)
  })

  /**
   * The selection is global — one inspector serves every panel — so a graph has to say which
   * document a pick belongs to, and read back only its own.
   */
  describe('the selection it publishes', () => {
    it('files a picked node under this document', () => {
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))
      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      clickNode(container, 'text1')

      expect(useSelection.getState().selection).toEqual({
        kind: 'node',
        ownerId: DOCUMENT,
        ids: ['text1'],
      })
    })

    /** Node ids are numbered per type, so `text1` exists in most graphs there are. */
    it('draws nothing as selected when the pick belongs to another graph', () => {
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))
      useSelection.getState().selectNodes('graph_2', ['text1'])
      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      expect(canvasNode(container, 'text1')).not.toHaveClass('selected')
    })

    /**
     * The asset shelf shares this space's screen, and `Selection` carries ONE kind at a time: a
     * thumbnail clicked would unhighlight the node and leave Suppr with nothing to delete. The
     * pick is therefore held above the store and only published to it.
     */
    it('keeps the node highlighted when another panel takes the selection', () => {
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))
      const { container } = render(<GraphDocument documentId={DOCUMENT} />)
      clickNode(container, 'text1')

      useSelection.getState().selectAssets(['asset_1'])

      expect(canvasNode(container, 'text1')).toHaveClass('selected')
    })

    /**
     * React Flow reports a deselection for a node it MOUNTED. One that left the graph while the
     * panel was down — an undone add, a tab reopened — is never spoken of again, and its id would
     * sit in the pick for the rest of the session: every later click would then read as two, and
     * the inspector would describe neither, for good.
     */
    it('forgets a picked node the graph no longer holds', () => {
      const store = useGraphs.getState()
      store.runCommand(DOCUMENT, addGraphNode(text))
      const { container } = render(<GraphDocument documentId={DOCUMENT} />)
      clickNode(container, 'text1')

      act(() => store.undo(DOCUMENT))

      expect(useSelection.getState().selection).toEqual({ kind: 'none' })
    })
  })

  /**
   * The whole chain of the gate, end to end: the store holds a question, the node draws it, and
   * the click reaches `decide`. Each half has its own suite — this is the wire between them, and
   * it is the one thing neither of them can prove.
   */
  describe('answering an approval on the canvas', () => {
    const approval: GraphNode = {
      id: 'approval1',
      type: 'approval',
      position: { x: 800, y: 0 },
      data: { message: 'On garde ?' },
    }

    it('hands the answer to the run of this very document', () => {
      const decide = vi.fn()
      useGraphRuns.setState({
        runs: {
          [DOCUMENT]: {
            running: true,
            nodes: { approval1: { status: 'awaiting' } },
            cache: new Map(),
          },
        },
        decide,
      })
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(approval))

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByText('Approuver'))

      expect(decide).toHaveBeenCalledWith(DOCUMENT, 'approval1', true)
    })
  })
})

const moveTo =
  (x: number) =>
  (graph: GraphState): GraphState => ({
    ...graph,
    nodes: graph.nodes.map(node => ({ ...node, position: { ...node.position, x } })),
  })
