import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { type GraphNode } from '@shared/domain/graph'
import { installGraph, nodeNow } from '@/stores/graph-fixtures'
import { updateNodeData } from '@/engines/graph/mutations'
import { graphOf, useGraphs } from '@/stores/graphs'
import { LiveNodeInspector } from './inspector-fixtures'

const DOCUMENT = 'graph-1'

const TEXT: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { value: 'a small grey rock' },
}

describe('LiveNodeInspector', () => {
  beforeEach(() => {
    installGraph(DOCUMENT, { nodes: [TEXT], edges: [], inputKeys: [] })
  })

  /**
   * The property four suites lean on, and the one a rewrite would quietly drop: handed a frozen
   * node, every field would keep reading the value it opened on — a suite typing two characters
   * would pass on the first and lose the second.
   */
  it('follows the store rather than the node it opened on', () => {
    render(<LiveNodeInspector documentId={DOCUMENT} id="text1" />)
    expect(screen.getByLabelText('Prompt')).toHaveValue('a small grey rock')

    act(() => {
      useGraphs.setState(state => ({
        states: {
          ...state.states,
          [DOCUMENT]: updateNodeData(graphOf(state, DOCUMENT), 'text1', { value: 'a kingfisher' }),
        },
      }))
    })

    expect(screen.getByLabelText('Prompt')).toHaveValue('a kingfisher')
  })

  it('renders nothing for an id the graph does not hold', () => {
    const { container } = render(<LiveNodeInspector documentId={DOCUMENT} id="text2" />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The document travels as a prop. An assurance, not a fix: all four suites happen to name their
   * document `graph-1` today, so a hard-coded id would hurt none of them — the fifth is what this
   * holds the door against.
   *
   * Two graphs have to stand at once for that to be observable — with a single one installed, a
   * fixture reading the wrong id finds nothing and renders nothing, which is what a missing node
   * looks like too. `installGraph` replaces the whole store, so the first is put back beside the
   * second by hand.
   */
  it('reads the document it is given, not one of its own', () => {
    installGraph('graph-2', {
      nodes: [{ ...TEXT, data: { value: 'a kingfisher' } }],
      edges: [],
      inputKeys: [],
    })
    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT], edges: [], inputKeys: [] } },
    }))

    render(<LiveNodeInspector documentId="graph-2" id="text1" />)

    expect(screen.getByLabelText('Prompt')).toHaveValue('a kingfisher')
  })

  /**
   * The document is handed DOWN as well as read: `GraphNodeInspector` edits through it. Read one
   * graph and write to another and the edit — with its undo history — lands in a document nobody
   * is looking at. Measured as a surviving mutation before this test existed.
   */
  it('edits the document it is given, not the one it read', async () => {
    installGraph('graph-2', {
      nodes: [{ ...TEXT, data: { value: 'a kingfisher' } }],
      edges: [],
      inputKeys: [],
    })
    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT], edges: [], inputKeys: [] } },
    }))

    render(<LiveNodeInspector documentId="graph-2" id="text1" />)
    await userEvent.type(screen.getByLabelText('Prompt'), '!')

    const dataIn = (documentId: string): GraphNode['data'] | undefined =>
      nodeNow(documentId, 'text1')?.data

    expect(dataIn('graph-2')).toMatchObject({ value: 'a kingfisher!' })
    expect(dataIn(DOCUMENT)).toMatchObject({ value: 'a small grey rock' })
  })
})
