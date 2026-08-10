import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GraphState } from '@shared/domain/graph'
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
        outputHandles: [{ id: 'text1-target-output', name: 'output', type: 'prompt' }],
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
      canUndo={false}
      canRedo={false}
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

    expect(screen.getByText('forEach')).toBeInTheDocument()
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
      expect(screen.getByRole('menuitem', { name: 'Image' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Vidéo' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: '3D' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Audio' })).toBeInTheDocument()
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
      expect(screen.getByRole('button', { name: 'Exécuter le graphe' })).toBeInTheDocument()

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
          canUndo={false}
          canRedo={false}
          runs={{}}
          running
        />,
      )

      expect(screen.getByRole('button', { name: 'Arrêter l’exécution' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Exécuter le graphe' })).not.toBeInTheDocument()
    })

    it('asks upward on the press, whichever of the two the button is offering', () => {
      const onRun = vi.fn()
      canvas(graph, { onRun })

      fireEvent.click(screen.getByRole('button', { name: 'Exécuter le graphe' }))

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
      expect(screen.getByText('en attente')).toBeInTheDocument()
    })

    it('leaves a node it has nothing to say about showing its type', () => {
      canvas(graph, { runs: { imageGenerator1: { status: 'idle' } } })

      expect(screen.getByText('model')).toBeInTheDocument()
    })
  })
})
