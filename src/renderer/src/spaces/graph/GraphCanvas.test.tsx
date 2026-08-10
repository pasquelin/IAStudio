import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import { GraphCanvas, type GraphCanvasProps } from './GraphCanvas'
import { canvasNode, clickNode } from './graph-canvas-fixtures'

/**
 * jsdom measures nothing, so React Flow renders its nodes but lays them out at zero. What can be
 * proved here is what the studio decides — which node is drawn, by which component, and which
 * ports it carries. Where they land on screen is checked in the running application.
 */
const graph: GraphState = {
  nodes: [
    {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        value: 'a small grey rock',
        outputHandles: [{ id: 'text1-target-prompt', name: 'output', type: 'text' }],
      },
    },
    {
      id: 'imageGenerator1',
      type: 'model',
      position: { x: 400, y: 0 },
      data: {
        modelId: 'model_flux',
        title: 'Coloring Page Generator',
        inputHandles: [
          { id: 'imageGenerator1-source-prompt', label: 'Prompt', type: ['prompt', 'text'] },
        ],
      },
    },
    // `content`, as Scenario writes it — `value` is the text and asset nodes' field.
    { id: 'note1', type: 'stickyNote', position: { x: 0, y: 300 }, data: { content: 'Read me' } },
  ],
  edges: [],
  inputKeys: [],
}

const noop = vi.fn()

type Overrides = Partial<GraphCanvasProps>

const canvas = (state: GraphState = graph, overrides: Overrides = {}) =>
  render(
    <GraphCanvas
      graph={state}
      onMove={noop}
      onRemoveNodes={noop}
      onConnect={noop}
      onDisconnect={noop}
      onAdd={noop}
      onDropAsset={noop}
      selectedNodeIds={[]}
      onSelectNodes={noop}
      onUndo={noop}
      onRedo={noop}
      onRun={noop}
      onDecide={noop}
      canUndo={false}
      canRedo={false}
      canRun={true}
      canExport={true}
      onExport={vi.fn()}
      onPublish={vi.fn()}
      published={null}
      runs={{}}
      running={false}
      {...overrides}
    />,
  )

describe('the graph canvas', () => {
  it('draws each node with the component its type names', () => {
    canvas()

    expect(screen.getByText('a small grey rock')).toBeInTheDocument()
    expect(screen.getByText('model_flux')).toBeInTheDocument()
    expect(screen.getByText('Read me')).toBeInTheDocument()
  })

  /** A node says what it is called; failing that, what it is — never nothing. */
  it('falls back to the name of the type when a node carries no title', () => {
    canvas()

    expect(screen.getByText('Coloring Page Generator')).toBeInTheDocument()
    expect(screen.getByText('Texte')).toBeInTheDocument()
  })

  /**
   * The ports are the graph's whole vocabulary, and a polymorphic one says the several things it
   * takes. Unlabelled, a port cannot be aimed at.
   */
  it('labels the ports of a node, polymorphic ones included', () => {
    canvas()

    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getByText('Sortie')).toBeInTheDocument()
  })

  it('draws the dotted background rather than React Flow’s own chrome', () => {
    const { container } = canvas()

    expect(container.querySelector('.react-flow__background')).toBeInTheDocument()
    expect(container.querySelector('.react-flow__controls')).not.toBeInTheDocument()
    expect(container.querySelector('.react-flow__minimap')).not.toBeInTheDocument()
  })

  /**
   * A graph read from Scenario holds loops and conditions long before the editor has a face for
   * them. Unlisted, React Flow falls back to a node of its own — and the ports it would be wired
   * by are simply not drawn.
   */
  it('draws a node type it has no face for yet, with its ports', () => {
    canvas({
      nodes: [
        {
          id: 'forEach1',
          type: 'forEach',
          position: { x: 0, y: 0 },
          data: {
            inputHandles: [{ id: 'forEach1-source-items', label: 'Items', type: 'image' }],
          },
        },
      ],
      edges: [],
      inputKeys: [],
    })

    // The TITLE, which is the translated name of the type — `forEach` is drawn beside it as the
    // raw kind, so asserting on that word alone passed whatever the node was titled.
    expect(screen.getByText('Boucle')).toBeInTheDocument()
    expect(screen.getByText('Items')).toBeInTheDocument()
  })

  it('draws an empty graph as an empty canvas rather than failing', () => {
    const { container } = canvas({ nodes: [], edges: [], inputKeys: [] })

    expect(container.querySelector('.react-flow')).toBeInTheDocument()
  })

  /**
   * The half of the selection the inspector reads. It is handed down rather than kept here
   * because a fully controlled canvas keeps none of its own — what is not given to it is not
   * selected, and the delete key would find nothing to delete.
   */
  describe('the selection of nodes', () => {
    it('reports upward the node that was clicked', () => {
      const onSelectNodes = vi.fn()
      const { container } = canvas(graph, { onSelectNodes })

      clickNode(container, 'text1')

      expect(onSelectNodes).toHaveBeenCalledWith(['text1'])
    })

    it('draws as selected the node it was handed, and only that one', () => {
      const { container } = canvas(graph, { selectedNodeIds: ['note1'] })

      expect(canvasNode(container, 'note1')).toHaveClass('selected')
      expect(canvasNode(container, 'text1')).not.toHaveClass('selected')
    })

    /**
     * That a batch leaving the selection alone reports nothing is NOT proved here, and a test
     * claiming to was removed rather than kept: React Flow emits no change at all when a click
     * alters nothing, so it stayed green with the guard taken out. What the guard rests on —
     * `selectionAfter` handing the very same set back — is proved in `adapter.test.ts`.
     */
    it('replaces the selection it reports when another node is clicked', () => {
      const onSelectNodes = vi.fn()
      const { container } = canvas(graph, { selectedNodeIds: ['text1'], onSelectNodes })

      clickNode(container, 'note1')

      expect(onSelectNodes).toHaveBeenCalledWith(['note1'])
    })
  })

  /**
   * An empty graph with no way to add a node is a space that opens on nothing and offers
   * nothing — which is what the canvas was until it was mounted anywhere.
   */
  describe('adding a node', () => {
    const rightClickPane = (container: HTMLElement): void => {
      const pane = container.querySelector('.react-flow__pane')
      if (!pane) throw new Error('no pane to right-click')
      fireEvent.contextMenu(pane, { clientX: 120, clientY: 40 })
    }

    /** The two groups Scenario's own palette reads: what comes in, and what generates. */
    it('offers the inputs it can fill and a generator per family', () => {
      const { container } = canvas({ nodes: [], edges: [], inputKeys: [] })
      rightClickPane(container)

      expect(screen.getByRole('menuitem', { name: 'Texte' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Asset' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Note' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Approbation' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Image' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Vidéo' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: '3D' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Audio' })).toBeInTheDocument()
    })

    // Eight nouns, four of which are the names of model families used everywhere else in the
    // studio: what the row ADDS to the graph is exactly what the label cannot carry.
    it('says what each row would add rather than naming it twice', () => {
      const { container } = canvas({ nodes: [], edges: [], inputKeys: [] })
      rightClickPane(container)

      const said = (name: string): string | null =>
        screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

      expect(said('Texte')).toBe(
        'Un texte que les nœuds suivants liront — un prompt, le plus souvent',
      )
      expect(said('Image')).toBe(
        'Génère une image depuis ses entrées — le modèle se choisit dans le panneau Modèles',
      )
      // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
      for (const row of screen.getAllByRole('menuitem')) {
        expect(row).not.toHaveAttribute('aria-label')
      }
    })

    // The position is the pointer's. That it is CONVERTED through the pan and the zoom cannot be
    // proved here — jsdom measures nothing, so the viewport is identity — and is checked on screen.
    it('hands the chosen entry back with the point it was asked for', () => {
      const onAdd = vi.fn()
      const { container } = canvas({ nodes: [], edges: [], inputKeys: [] }, { onAdd })
      rightClickPane(container)

      fireEvent.click(screen.getByRole('menuitem', { name: 'Texte' }))

      expect(onAdd).toHaveBeenCalledWith(
        { group: 'input', id: 'text', node: 'text' },
        expect.objectContaining({ x: 120, y: 40 }),
      )
    })

    /** A generator is one `model` node narrowed to a family, never a node type of its own. */
    it('names the family a generator entry stands for', () => {
      const onAdd = vi.fn()
      const { container } = canvas({ nodes: [], edges: [], inputKeys: [] }, { onAdd })
      rightClickPane(container)

      fireEvent.click(screen.getByRole('menuitem', { name: 'Vidéo' }))

      expect(onAdd).toHaveBeenCalledWith(
        { group: 'generator', id: 'generator-video', family: 'video' },
        expect.anything(),
      )
    })

    it('closes the menu on the choice rather than leaving it under the pointer', () => {
      const { container } = canvas({ nodes: [], edges: [], inputKeys: [] })
      rightClickPane(container)

      fireEvent.click(screen.getByRole('menuitem', { name: 'Note' }))

      expect(screen.queryByRole('menuitem', { name: 'Note' })).not.toBeInTheDocument()
    })
  })

  /**
   * A graph that describes without running is what this space was until now, and the one button
   * that changes it is here rather than in the panel: it acts on the graph in front of the eye.
   */
  describe('running the graph', () => {
    it('offers a run, and a stop in its place while one is going', () => {
      const { rerender } = canvas()
      expect(
        screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' }),
      ).toBeInTheDocument()

      rerender(
        <GraphCanvas
          graph={graph}
          onMove={noop}
          onRemoveNodes={noop}
          onConnect={noop}
          onDisconnect={noop}
          onAdd={noop}
          onDropAsset={noop}
          selectedNodeIds={[]}
          onSelectNodes={noop}
          onUndo={noop}
          onRedo={noop}
          onRun={noop}
          onDecide={noop}
          canUndo={false}
          canRedo={false}
          canRun={true}
          canExport={true}
          onExport={vi.fn()}
          onPublish={vi.fn()}
          published={null}
          runs={{}}
          running
        />,
      )

      expect(
        screen.getByRole('button', { name: 'Arrêter l’exécution (⌘Entrée)' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' }),
      ).not.toBeInTheDocument()
    })

    it('asks upward on the press, whichever of the two the button is offering', () => {
      const onRun = vi.fn()
      canvas(graph, { onRun })

      fireEvent.click(screen.getByRole('button', { name: 'Exécuter le graphe (⌘Entrée)' }))

      expect(onRun).toHaveBeenCalledOnce()
    })

    /** Painted on the node itself: a run of twenty nodes cannot be followed in a list elsewhere. */
    it('says on a node what it is doing', () => {
      canvas(graph, { runs: { imageGenerator1: { status: 'running' } } })

      expect(screen.getByText('en cours')).toBeInTheDocument()
    })

    /**
     * "Failed" alone would send the user to the jobs panel for a node that never reached it — a
     * loop, a missing model and a type the editor cannot run yet all read the same otherwise.
     */
    it('names why a node produced nothing rather than saying only that it did not', () => {
      canvas(graph, {
        runs: {
          imageGenerator1: { status: 'failed', failure: 'cycle' },
          text1: { status: 'failed', failure: 'blocked' },
        },
      })

      expect(screen.getByText('boucle')).toBeInTheDocument()
      // Not « en attente » : a node whose providers are still going says nothing at all, so that
      // wording read as "not started yet" on the one state that means the opposite.
      expect(screen.getByText('amont en échec')).toBeInTheDocument()
    })

    it('leaves a node it has nothing to say about showing its type', () => {
      canvas(graph, { runs: { imageGenerator1: { status: 'idle' } } })

      expect(screen.getByText('model')).toBeInTheDocument()
    })
  })
})

describe('the transform node', () => {
  it('reads its expression back on its own face, where a graph is read at a glance', () => {
    canvas({
      nodes: [
        {
          id: 'transformText1',
          type: 'transformText',
          position: { x: 0, y: 0 },
          data: { value: "'A photo of ' + text1_output" },
        },
      ],
      edges: [],
      inputKeys: [],
    })

    expect(screen.getByText("'A photo of ' + text1_output")).toBeInTheDocument()
  })

  /** A transform nobody has written into still says what it is, rather than drawing an empty box. */
  it('names its type where no expression has been written yet', () => {
    canvas({
      nodes: [{ id: 'transformText1', type: 'transformText', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      inputKeys: [],
    })

    expect(screen.getByText('Transformation')).toBeInTheDocument()
  })
})

/**
 * The one node that asks something of the user rather than telling them something. Its two
 * answers are drawn only while a run is stopped on it — an approval on an idle canvas is a gate
 * someone will pass through later, not a decision to take now.
 */
describe('the approval node', () => {
  const withApproval: GraphState = {
    ...graph,
    nodes: [
      ...graph.nodes,
      {
        id: 'approval1',
        type: 'approval',
        position: { x: 700, y: 0 },
        data: { message: 'Garde-t-on cette image ?', inputHandles: [] },
      },
    ],
  }

  it('shows the question its own data carries', () => {
    canvas(withApproval)

    expect(screen.getByText('Garde-t-on cette image ?')).toBeInTheDocument()
  })

  it('asks a sentence of its own where the node carries no question', () => {
    canvas({
      nodes: [{ id: 'approval1', type: 'approval', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      inputKeys: [],
    })

    expect(screen.getByText('Approuver ce résultat ?')).toBeInTheDocument()
  })

  /**
   * By its text and not by its role, and jsdom is the reason: React Flow leaves a node
   * `visibility: hidden` until it has measured one, jsdom measures nothing, and a hidden button
   * computes an EMPTY accessible name — so `getByRole('button', { name })` finds nothing however
   * `hidden` is set. What it is is checked below instead. The file's own header says the rest.
   */
  const answer = (label: string): HTMLElement => screen.getByText(label)

  it('offers no answer while nothing is being asked', () => {
    canvas(withApproval)

    expect(screen.queryByText('Approuver')).not.toBeInTheDocument()
    expect(screen.queryByText('Rejeter')).not.toBeInTheDocument()
  })

  it('offers both answers once the run has stopped on it', () => {
    const onDecide = vi.fn()
    canvas(withApproval, { runs: { approval1: { status: 'awaiting' } }, onDecide })

    fireEvent.click(answer('Approuver'))
    expect(onDecide).toHaveBeenCalledWith('approval1', true)

    fireEvent.click(answer('Rejeter'))
    expect(onDecide).toHaveBeenCalledWith('approval1', false)
  })

  /** React Flow starts dragging on a press inside a node unless the control opts out. */
  it('keeps its buttons out of the drag React Flow would start', () => {
    canvas(withApproval, { runs: { approval1: { status: 'awaiting' } } })

    expect(answer('Approuver').tagName).toBe('BUTTON')
    expect(answer('Approuver').closest('.nodrag')).not.toBeNull()
  })

  /** Its own tone, or a node waiting on a hand reads exactly like one waiting on the API. */
  it('says it is waiting in a tone of its own', () => {
    canvas(withApproval, { runs: { approval1: { status: 'awaiting' } } })

    expect(screen.getByText('à approuver')).toHaveClass('text-warning')
  })
})

/**
 * Which way a graph forks is the one thing about it the wires cannot say: two edges leave a
 * branch and nothing on them tells which is the case and which the else. So the face reads out
 * what each branch asks, in the order its output ports carry them.
 */
describe('the branch node', () => {
  const withBranch = (data: GraphNode['data']): GraphState => ({
    ...graph,
    nodes: [...graph.nodes, { id: 'ifElse1', type: 'ifElse', position: { x: 700, y: 0 }, data }],
  })

  it('reads out what each branch asks, in the order the ports carry them', () => {
    canvas(
      withBranch({
        conditionBlocks: [
          {
            logic: 'or',
            conditions: [
              { field: 'text1', operator: 'contains', value: 'knight' },
              { field: 'text1', operator: 'isEmpty' },
            ],
          },
          {
            logic: 'and',
            conditions: [{ field: 'text1', operator: 'between', value: ['1', '9'] }],
          },
        ],
      }),
    )

    expect(screen.getByText('text1 contient knight ou text1 est vide')).toBeInTheDocument()
    expect(screen.getByText('text1 entre 1…9')).toBeInTheDocument()
  })

  /** A branch read off a file may hold nothing at all, and it must not read as an empty node. */
  it('says so when nothing is asked', () => {
    canvas(withBranch({}))

    expect(screen.getByText('Aucune condition')).toBeInTheDocument()
  })

  /**
   * `parseGraph` keeps `data` as it found it: everything here reaches the face off a file. An
   * operator the studio cannot read is DROPPED, not shown as the `equals` it once became — the
   * face would otherwise draw a comparison the run does not make and the converter refuses.
   */
  it('drops a condition a file made up rather than drawing one it does not make', () => {
    canvas(withBranch(JSON.parse('{"conditionBlocks":[{"conditions":[{"operator":7}]}]}')))

    // The branch still draws — a block with nothing readable left in it is still a branch — but
    // the comparison the file invented is nowhere on it.
    expect(screen.queryByText('Rien égale')).not.toBeInTheDocument()
    expect(screen.queryByText(/égale/)).not.toBeInTheDocument()
  })
})
