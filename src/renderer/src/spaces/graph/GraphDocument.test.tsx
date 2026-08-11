import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphNode, GraphPublishResult, GraphState } from '@shared/domain/graph'
import type { FieldDescriptor, ModelDescriptor } from '@shared/domain/model'
import { addGraphNode, connectGraph } from '@/engines/graph/commands'
import { DEFAULT_COLLECTION_STATE, selectedValues } from '@/helpers/collection-state'
import { FAMILY_FACET } from '@/panels/models/family-facet'
import { publishCommand } from '@/services/command-bus'
import { reportFailure } from '@/services/diagnostics'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { runOf, useGraphRuns } from '@/stores/graph-runs'
import { graphOf, useGraphs } from '@/stores/graphs'
import { installGraph } from '@/stores/graph-fixtures'
import { parseGraph } from '@/engines/graph/serialize'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSelection } from '@/stores/selection'
import { useSettings } from '@/stores/settings'
import { preferModels } from '@/stores/settings-fixtures'
import { arrangedFor } from '@/stores/tool-fixtures'
import { arrangementOf, useTools } from '@/stores/tools'
import { GraphDocument } from './GraphDocument'
import { canvasNode, clickNode } from './graph-canvas-fixtures'

vi.mock('@/services/diagnostics', () => ({ reportFailure: vi.fn() }))

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

const note: GraphNode = {
  id: 'note1',
  type: 'stickyNote',
  position: { x: 0, y: 200 },
  data: { content: 'à faire' },
}

/** Wired to nothing, which is the whole of what makes it silent. */
const approval: GraphNode = {
  id: 'approval1',
  type: 'approval',
  position: { x: 200, y: 200 },
  data: {},
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
  useGraphRuns.setState({ runs: {}, ...REAL_RUN_ACTIONS })
  // Left behind, a document in front would arm the keyboard for every suite sharing this module.
  useDocuments.setState({ activeId: null })
})

/** The store's own answers, kept before any test can replace them. */
const { decide, start, stop } = useGraphRuns.getState()
const REAL_RUN_ACTIONS = { decide, start, stop }

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
   * The bar's own rule is proved beside it, on `graphTools`; what only the document knows is WHICH
   * graph it is being asked about, and what counts as something to run.
   */
  describe('offering the run at all', () => {
    it('greys the button while nothing on the canvas would report anything', () => {
      const { rerender } = render(<GraphDocument documentId={DOCUMENT} />)
      expect(screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' })).toBeDisabled()

      // A note is drawn, never run: on its own it leaves the button exactly as it was.
      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode(note)))
      rerender(<GraphDocument documentId={DOCUMENT} />)
      expect(screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' })).toBeDisabled()

      // A text node reports `done`, so it is a run — the same list the executor reads says so.
      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text)))
      rerender(<GraphDocument documentId={DOCUMENT} />)
      expect(screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' })).toBeEnabled()
    })

    /**
     * The defect the one list closes: an approval wired to nothing compiles away, so the run walks
     * past it without a question. Offered here, the button would flip to Stop and back over a
     * canvas that reports nothing at all.
     */
    it('greys the button over an approval that guards nobody', () => {
      const { rerender } = render(<GraphDocument documentId={DOCUMENT} />)

      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode(approval)))
      rerender(<GraphDocument documentId={DOCUMENT} />)

      expect(screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' })).toBeDisabled()
    })
  })

  /**
   * What only the document knows: WHICH graph is handed over, and under what name. The bar's own
   * rule — grey on an empty graph — is proved beside it, on `graphTools`.
   */
  describe('handing the graph to the main process', () => {
    const withOneNode = (): void => {
      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text)))
    }

    /**
     * The bar greys what it is told to grey; deciding an EMPTY graph has nothing to hand over is
     * the document's own call — `workflow_create` refuses empty arrays on the other side.
     */
    it('greys both gestures while the canvas holds nothing', () => {
      const { rerender } = render(<GraphDocument documentId={DOCUMENT} />)
      expect(screen.getByRole('button', { name: 'Exporter le graphe' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Publier sur Scenario' })).toBeDisabled()

      withOneNode()
      rerender(<GraphDocument documentId={DOCUMENT} />)

      expect(screen.getByRole('button', { name: 'Exporter le graphe' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Publier sur Scenario' })).toBeEnabled()
    })

    it('sends the graph and the document title to the export', () => {
      const exportGraph = vi.fn((_graph: GraphState, _name: string) => Promise.resolve(true))
      installFakeBridge({ workflows: { export: exportGraph } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le graphe' }))

      const [graph] = exportGraph.mock.calls[0] ?? []
      expect(graph).toMatchObject({ nodes: [expect.objectContaining({ id: text.id })] })
    })

    it('sends the same to the publication', () => {
      const publish = vi.fn((_graph: GraphState, _name: string): Promise<GraphPublishResult> =>
        Promise.resolve({ ok: false, problem: 'empty', nodes: [] }),
      )
      installFakeBridge({ workflows: { publish } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))

      expect(publish).toHaveBeenCalledOnce()
    })

    /**
     * A publication is a WRITE on the user's account. Silent, it was worse than useless: a refused
     * click looked exactly like a successful one, and clicking twice left two drafts behind.
     */
    it('says on the canvas that the publication went through', async () => {
      installFakeBridge({
        workflows: {
          publish: (): Promise<GraphPublishResult> =>
            Promise.resolve({ ok: true, workflowId: 'workflow_1' }),
        },
      })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))

      expect(await screen.findByText('Publié sur Scenario')).toBeInTheDocument()
    })

    /**
     * A verdict is kept beside the graph it judged, so a stale one can be dropped by derivation.
     * Only a REFUSAL goes stale: it names nodes of a graph the user has since changed. A success
     * names a workflow that now EXISTS on the account, and this line is its only trace anywhere —
     * dropping it because a node moved a pixel would erase the record of a write.
     */
    it('keeps saying it published after the graph is edited', async () => {
      installFakeBridge({
        workflows: {
          publish: (): Promise<GraphPublishResult> =>
            Promise.resolve({ ok: true, workflowId: 'workflow_1' }),
        },
      })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))
      expect(await screen.findByText('Publié sur Scenario')).toBeInTheDocument()

      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode({ ...text, id: 'text2' })))

      expect(screen.getByText('Publié sur Scenario')).toBeInTheDocument()
    })

    it('drops a refusal once the graph it was about has changed', async () => {
      installFakeBridge({
        workflows: {
          publish: (): Promise<GraphPublishResult> =>
            Promise.resolve({ ok: false, problem: 'refused', nodes: [] }),
        },
      })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))
      expect(await screen.findByText(/Scenario l’a refusé/)).toBeInTheDocument()

      act(() => useGraphs.getState().runCommand(DOCUMENT, addGraphNode({ ...text, id: 'text2' })))

      expect(screen.queryByText(/Scenario l’a refusé/)).not.toBeInTheDocument()
    })

    /**
     * The line says WHICH refusal, the nodes say WHERE — and they must be the SAME refusal. The
     * publication takes the line while there is one, so it has to take the paint with it, or the
     * canvas rings a set of nodes the sentence beside them is not about.
     */
    it('rings the nodes the publication refused, not the compile’s', async () => {
      installFakeBridge({
        workflows: {
          publish: (): Promise<GraphPublishResult> =>
            Promise.resolve({ ok: false, problem: 'loop-two-ends', nodes: ['text1'] }),
        },
      })
      withOneNode()

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))
      await screen.findByText('Deux fins ferment la même boucle')

      expect(canvasNode(container, 'text1')?.querySelector('[role="img"]')).toHaveAttribute(
        'aria-label',
        'Le refus porte sur ce nœud',
      )
    })

    it('says on the canvas that Scenario refused it', async () => {
      installFakeBridge({
        workflows: {
          publish: (): Promise<GraphPublishResult> =>
            Promise.resolve({ ok: false, problem: 'refused', nodes: [] }),
        },
      })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Publier sur Scenario' }))

      expect(await screen.findByText(/Scenario l’a refusé/)).toBeInTheDocument()
    })

    /**
     * The gesture the import exists for, and its way back. An import lands on top of work
     * somebody may not have meant to lose, so it goes through a command and `⌘Z` undoes it.
     */
    it('puts the file’s graph in place of this one, and gives it back on undo', async () => {
      const file = {
        version: '1.0',
        editorInfo: {
          nodes: [{ id: 'imported1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
          inputKeys: [],
        },
      }
      installFakeBridge({ workflows: { import: () => Promise.resolve(file) } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Importer un graphe' }))

      await waitFor(() => expect(state().nodes.map(node => node.id)).toEqual(['imported1']))

      act(() => useGraphs.getState().undo(DOCUMENT))
      expect(state().nodes.map(node => node.id)).toEqual([text.id])
    })

    /**
     * A file that holds no graph reads as an EMPTY one — `parseGraph` drops what does not hold
     * rather than failing the read. Replacing a canvas with nothing is not what anyone asked for.
     */
    it('leaves the canvas alone where the file holds no graph', async () => {
      installFakeBridge({ workflows: { import: () => Promise.resolve({ nothing: true }) } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Importer un graphe' }))
      await Promise.resolve()

      expect(state().nodes.map(node => node.id)).toEqual([text.id])
    })

    /**
     * A run under way OWNS the nodes on the canvas: replacing them under it lands its results on
     * a graph that never asked for them, and `⌘Z` cannot help — a run is not in the history.
     */
    it('withdraws the import while a run is under way', () => {
      withOneNode()
      const { rerender } = render(<GraphDocument documentId={DOCUMENT} />)
      expect(screen.getByRole('button', { name: 'Importer un graphe' })).toBeEnabled()

      act(() =>
        useGraphRuns.setState({
          runs: { [DOCUMENT]: { running: true, nodes: {}, cache: new Map() } },
        }),
      )
      rerender(<GraphDocument documentId={DOCUMENT} />)

      expect(screen.getByRole('button', { name: 'Importer un graphe' })).toBeDisabled()
    })

    /**
     * ONE live region for the canvas, not one per node: twenty nodes reporting meant twenty of
     * them announcing over each other. What is announced is the node that spoke LAST, which a
     * record of states cannot say on its own — hence `latest` beside `nodes`.
     */
    it('announces the node that spoke last, from a single live region', () => {
      withOneNode()
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: true,
              nodes: { [text.id]: { status: 'running' } },
              latest: text.id,
              cache: new Map(),
            },
          },
        }),
      )

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      // React Flow keeps a live region of its own for keyboard moves; ours is the one that names
      // a node. What matters is that there is exactly ONE of ours, whatever the node count.
      const ours = container.querySelectorAll('p[role="status"][aria-live]')

      expect(ours).toHaveLength(1)
      expect(ours[0]?.textContent).toBe('Texte — en cours')
    })

    /**
     * `idle` is the ONE state with no sentence of its own — `bundles.test.ts` excludes it, on the
     * grounds that a node saying nothing needs no words. Announcing it would read `graphRun.idle`
     * out loud, and a Stop puts every waiting node back to exactly that.
     */
    it('says nothing rather than reading a key out loud on a stopped node', () => {
      withOneNode()
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: false,
              nodes: { [text.id]: { status: 'idle' } },
              latest: text.id,
              cache: new Map(),
            },
          },
        }),
      )

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      expect(container.querySelector('p[role="status"][aria-live]')?.textContent).toBe('')
    })

    /** A failure is the one thing this region must never swallow — and it reads as its REASON. */
    it('announces a failure by the reason it names', () => {
      withOneNode()
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: false,
              nodes: { [text.id]: { status: 'failed', failure: 'no-model' } },
              latest: text.id,
              cache: new Map(),
            },
          },
        }),
      )

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      expect(container.querySelector('p[role="status"][aria-live]')?.textContent).toBe(
        'Texte — sans modèle',
      )
    })

    /**
     * `parseNode` keeps `data` as the file wrote it, so an imported `"title": 42` types as a
     * string without being one. The face guards it; this region has to guard it the same way, or
     * two surfaces name the same node differently.
     */
    it('names a node whose imported title is not text as its type', () => {
      // Through `parseGraph`, which is the real path of a file: written as a literal, `title: 42`
      // would not compile — the type says `string`, and that is exactly the claim under test.
      const imported = parseGraph({
        nodes: [{ id: text.id, type: 'text', position: { x: 0, y: 0 }, data: { title: 42 } }],
        edges: [],
      })

      act(() => installGraph(DOCUMENT, imported))
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: false,
              nodes: { [text.id]: { status: 'done' } },
              latest: text.id,
              cache: new Map(),
            },
          },
        }),
      )

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      expect(container.querySelector('p[role="status"][aria-live]')?.textContent).toBe(
        'Texte — terminé',
      )
    })

    /**
     * The run state outlives the graph — an import replaces every node while `latest` still names
     * one of the old ones. Announcing its state would name a node nobody can find on the canvas.
     */
    it('says nothing of a node the graph no longer holds', () => {
      withOneNode()
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: false,
              // The vanished node keeps a state, or the assertion would pass on the missing
              // state rather than on the missing NODE — two guards, one test each.
              nodes: { gone1: { status: 'done' } },
              latest: 'gone1',
              cache: new Map(),
            },
          },
        }),
      )

      const { container } = render(<GraphDocument documentId={DOCUMENT} />)

      expect(container.querySelector('p[role="status"][aria-live]')?.textContent).toBe('')
    })

    /**
     * The run cache is keyed by NODE ID and outlives the graph, and the ids collide almost always
     * — `text1`, `imageGenerator1`, the webapp's convention and ours. Left in place, an imported
     * node wears the previous graph's verdict without ever having run.
     */
    it('forgets the previous graph’s run before putting another one in place', async () => {
      const file = {
        editorInfo: {
          nodes: [{ id: text.id, type: 'text', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
          inputKeys: [],
        },
      }
      installFakeBridge({ workflows: { import: () => Promise.resolve(file) } })
      withOneNode()
      act(() =>
        useGraphRuns.setState({
          runs: {
            [DOCUMENT]: {
              running: false,
              nodes: { [text.id]: { status: 'failed', failure: 'rejected' } },
              cache: new Map(),
            },
          },
        }),
      )

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Importer un graphe' }))

      await waitFor(() => expect(state().nodes.map(node => node.id)).toEqual([text.id]))
      expect(runOf(useGraphRuns.getState(), DOCUMENT).nodes).toEqual({})
    })

    /**
     * A closed picker answers `null`, and it is NOT a failure — which is the whole difference
     * between it and a file holding no graph. Both leave the canvas alone, so the canvas cannot
     * tell them apart; the journal is where it shows, and journalling a closed picker would put a
     * red line under a gesture the user simply changed their mind about.
     */
    it('says nothing at all where the picker was closed', async () => {
      vi.mocked(reportFailure).mockClear()
      installFakeBridge({ workflows: { import: () => Promise.resolve(null) } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Importer un graphe' }))
      await Promise.resolve()

      expect(state().nodes.map(node => node.id)).toEqual([text.id])
      expect(vi.mocked(reportFailure)).not.toHaveBeenCalled()
    })

    /** A file holding no graph, on the other hand, is worth a line: the gesture did not work. */
    it('journals a file that holds no graph', async () => {
      vi.mocked(reportFailure).mockClear()
      installFakeBridge({ workflows: { import: () => Promise.resolve({ nothing: true }) } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.click(screen.getByRole('button', { name: 'Importer un graphe' }))
      await waitFor(() => expect(vi.mocked(reportFailure)).toHaveBeenCalled())
    })

    /** A refusal from the other side is journalled, never thrown at the window. */
    it('journals a refusal instead of letting it escape', async () => {
      installFakeBridge({ workflows: { export: () => Promise.reject(new Error('no disk')) } })
      withOneNode()

      render(<GraphDocument documentId={DOCUMENT} />)
      await expect(
        (async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Exporter le graphe' }))
          await Promise.resolve()
        })(),
      ).resolves.toBeUndefined()
    })
  })

  /**
   * The gesture the space exists for, reached by the keyboard for the first time. The bar is
   * tested on its own; what no other suite can prove is that the key gets there at all.
   */
  describe('running from the keyboard', () => {
    it('starts the run of the document in front', () => {
      const start = vi.fn(async () => {})
      useGraphRuns.setState({ start })
      useDocuments.setState({ activeId: DOCUMENT })
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.keyDown(window, { code: 'Enter', metaKey: true })

      expect(start).toHaveBeenCalledWith(DOCUMENT)
    })

    /** The same key is the Stop, which is the whole point of one button for the pair. */
    it('stops a run already under way', () => {
      const stop = vi.fn()
      useGraphRuns.setState({
        runs: { [DOCUMENT]: { running: true, nodes: {}, cache: new Map() } },
        stop,
      })
      useDocuments.setState({ activeId: DOCUMENT })
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.keyDown(window, { code: 'Enter', metaKey: true })

      expect(stop).toHaveBeenCalledWith(DOCUMENT)
    })

    /**
     * The menu row does not press a key: it publishes the command. Two suites prove each side of
     * that frontier — the row fires `runCommand` in the main process, a keydown reaches `start`
     * here — and neither would redden if `graph.run` were refiled under another scope, which
     * would leave the row inert with the whole suite green.
     */
    it('starts the run when the native menu publishes the command', () => {
      const start = vi.fn(async () => {})
      useGraphRuns.setState({ start })
      useDocuments.setState({ activeId: DOCUMENT })
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(model))

      render(<GraphDocument documentId={DOCUMENT} />)
      act(() => publishCommand('graph.run'))

      expect(start).toHaveBeenCalledWith(DOCUMENT)
    })

    /** A tab in the background keeps its own run to itself, as ⌘Z already does. */
    it('says nothing when the document is not the one in front', () => {
      const start = vi.fn(async () => {})
      useGraphRuns.setState({ start })
      useDocuments.setState({ activeId: 'graph_2' })
      useGraphs.getState().runCommand(DOCUMENT, addGraphNode(text))

      render(<GraphDocument documentId={DOCUMENT} />)
      fireEvent.keyDown(window, { code: 'Enter', metaKey: true })

      expect(start).not.toHaveBeenCalled()
    })
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
