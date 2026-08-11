import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { CONDITIONAL_PORT, type GraphEdge, type GraphNode } from '@shared/domain/graph'
import { edgeBetween } from '@/engines/graph/connect'
import { forEachEndNode, forEachNode, textNode, wire } from '@/engines/graph/graph-fixtures'
import { handleId, loopInputId, loopOutputId } from '@/engines/graph/handles'
import { installGraph, nodeNow } from '@/stores/graph-fixtures'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { LiveNodeInspector } from './inspector-fixtures'

const DOCUMENT = 'graph-1'

const LOOP: GraphNode = forEachNode('forEach1', ['image'])
const END: GraphNode = forEachEndNode('end1', 'forEach1')
const TEXT: GraphNode = textNode('text1')

/** A model reading the item of the first list — the port a removed list takes with it. */
const READS_ITEM: GraphEdge = edgeBetween(
  'model1',
  handleId('model1', 'source', 'prompt'),
  'forEach1',
  loopOutputId('forEach1', 0),
)

/**
 * A wire on the port no list owns, so an edit of the lists can be asked what it LEFT rather than
 * only that it emptied the graph. `conditional` steers rather than feeds, so no retyping of a list
 * reaches it — and written the wrong way round, this one would be cut with the rest, which is the
 * whole reason the assertions below name it.
 */
const STEERS: GraphEdge = wire('forEach1', CONDITIONAL_PORT, 'text1', 'prompt')

beforeEach(() => {
  installGraph(DOCUMENT, { nodes: [LOOP, END, TEXT], edges: [], inputKeys: [] })
})

const nodeOf = (id: string): GraphNode | null => nodeNow(DOCUMENT, id)

const inputs = (): readonly string[] =>
  (nodeOf('forEach1')?.data.inputHandles ?? []).map(handle => handle.id)

const outputs = (): readonly (string | undefined)[] =>
  (nodeOf('forEach1')?.data.outputHandles ?? []).map(handle => handle.id)

const types = (): readonly (string | undefined)[] =>
  (nodeOf('forEach1')?.data.outputHandles ?? []).map(handle => handle.type)

const edgeIds = (): readonly string[] =>
  graphOf(useGraphs.getState(), DOCUMENT).edges.map(edge => edge.id)

const show = (id: string): void => {
  render(<LiveNodeInspector documentId={DOCUMENT} id={id} />)
}

describe('the lists a loop walks', () => {
  it('offers nothing of the sort on a node that does not loop', () => {
    show('text1')

    expect(screen.queryByLabelText('Ce que cette liste contient')).not.toBeInTheDocument()
  })

  it('shows one row per list, and the conditional port is not one', () => {
    show('forEach1')

    expect(screen.getAllByLabelText('Ce que cette liste contient')).toHaveLength(1)
    expect(screen.getByText('Liste 1')).toBeInTheDocument()
  })

  /**
   * A list is a PAIR of ports sharing a number: the converter reads the flow input off
   * `-input-${n}` and the item of the iteration off `-output-${n}`. Added on one side alone, the
   * loop would walk a list whose item nothing can read.
   */
  it('grows both ports with every list added', async () => {
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une liste à parcourir/ }))

    expect(inputs()).toEqual([
      'forEach1-source-conditional',
      loopInputId('forEach1', 0),
      loopInputId('forEach1', 1),
    ])
    expect(outputs()).toEqual([loopOutputId('forEach1', 0), loopOutputId('forEach1', 1)])
  })

  it('takes both ports away with the list', async () => {
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette liste/ }))

    expect(inputs()).toEqual(['forEach1-source-conditional'])
    expect(outputs()).toEqual([])
  })

  /**
   * An edge aimed at a port no node carries is refused by `validateWorkflowFlow` at export, far
   * from the gesture that caused it — which is why dropping a list cuts what read its item.
   */
  it('cuts the wire that read the item of a removed list', async () => {
    installGraph(DOCUMENT, {
      nodes: [LOOP, END, TEXT],
      edges: [READS_ITEM, STEERS],
      inputKeys: [],
    })
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette liste/ }))

    expect(edgeIds()).toEqual([STEERS.id])
  })

  /**
   * The kind decides the NAME: the converter calls the item `text${n}` when the output port says
   * `text` and `image${n}` otherwise. Written on the output alone, the input would still take a
   * picture, and the loop body would then read a variable the flow never declared.
   */
  it('retypes both ports of a list at once', async () => {
    show('forEach1')
    await userEvent.selectOptions(screen.getByLabelText('Ce que cette liste contient'), 'text')

    expect(types()).toEqual(['text'])
    expect(nodeOf('forEach1')?.data.inputHandles?.at(-1)?.type).toBe('text')
  })

  /**
   * And the wire already on it goes: the port ids do not change, so nothing else would have cut
   * it, and the canvas would refuse to draw it now. Left in place, the compiled flow declares the
   * list under the PROVIDER's kind while the body reads it under the port's — two names for one
   * list, and `validateWorkflowFlow` says nothing.
   */
  it('cuts the wire a retyped list would no longer accept', async () => {
    const feeds: GraphEdge = edgeBetween(
      'forEach1',
      loopInputId('forEach1', 0),
      'text1',
      handleId('text1', 'target', 'prompt'),
    )
    installGraph(DOCUMENT, {
      nodes: [forEachNode('forEach1', ['text']), END, TEXT],
      edges: [feeds, STEERS],
      inputKeys: [],
    })
    show('forEach1')
    expect(edgeIds()).toEqual([feeds.id, STEERS.id])

    await userEvent.selectOptions(screen.getByLabelText('Ce que cette liste contient'), 'image')

    expect(edgeIds()).toEqual([STEERS.id])
  })

  /** And a wire the new kind still accepts stays: only what no longer connects is cut. */
  it('keeps the wire of another list while one is retyped', async () => {
    const feeds: GraphEdge = edgeBetween(
      'forEach1',
      loopInputId('forEach1', 1),
      'text1',
      handleId('text1', 'target', 'prompt'),
    )
    installGraph(DOCUMENT, {
      nodes: [forEachNode('forEach1', ['image', 'text']), END, TEXT],
      edges: [feeds],
      inputKeys: [],
    })
    show('forEach1')

    const [first] = screen.getAllByLabelText('Ce que cette liste contient')
    if (!first) throw new Error('no list to retype')
    await userEvent.selectOptions(first, 'text')

    expect(edgeIds()).toEqual([feeds.id])
  })

  /** One entry, so ⌘Z never gives a list back without the port its item leaves by. */
  it('undoes the two sides together', async () => {
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une liste à parcourir/ }))
    expect(outputs()).toHaveLength(2)
    const past = historyOf(useGraphs.getState(), DOCUMENT).past.length

    useGraphs.getState().undo(DOCUMENT)

    expect(past).toBe(1)
    expect(inputs()).toEqual(['forEach1-source-conditional', loopInputId('forEach1', 0)])
    expect(outputs()).toEqual([loopOutputId('forEach1', 0)])
  })

  /**
   * A loop the editor never made carries ports of a file's own numbering. Numbered on the COUNT,
   * the added list would take a number already in use, and the converter's `.find` would hand the
   * flow whichever port came first.
   */
  it('numbers an added list past the highest a file already wrote', async () => {
    const theirs: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: {
        inputHandles: [{ id: loopInputId('forEach1', 7) }],
        outputHandles: [{ id: loopOutputId('forEach1', 7) }],
      },
    }
    installGraph(DOCUMENT, { nodes: [theirs, END, TEXT], edges: [], inputKeys: [] })
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une liste à parcourir/ }))

    expect(outputs()).toEqual([loopOutputId('forEach1', 7), loopOutputId('forEach1', 8)])
  })
})

describe('the loop an end closes', () => {
  /**
   * `parentNodeId` is what pairs the two, and without it the converter resolves every wire leaving
   * the end to nothing: the loop compiles with an empty body, and says nothing about it.
   */
  it('writes the loop chosen', async () => {
    installGraph(DOCUMENT, {
      nodes: [LOOP, forEachEndNode('end1'), TEXT],
      edges: [],
      inputKeys: [],
    })
    show('end1')
    expect(screen.getByLabelText('Boucle fermée')).toHaveValue('')

    await userEvent.selectOptions(screen.getByLabelText('Boucle fermée'), 'forEach1')

    expect(nodeOf('end1')?.data).toMatchObject({ parentNodeId: 'forEach1' })
  })

  /** And back again: the fixture omits the field, the editor writes it, and both must read as none. */
  it('unpairs an end from its loop', async () => {
    show('end1')
    await userEvent.selectOptions(screen.getByLabelText('Boucle fermée'), '')

    expect(nodeOf('end1')?.data).toMatchObject({ parentNodeId: '' })
    expect(screen.getByLabelText('Boucle fermée')).toHaveValue('')
  })

  it('offers the loops of the graph, and the option of none', () => {
    show('end1')

    expect(screen.getByRole('option', { name: 'Aucune boucle' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'forEach1' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'text1' })).not.toBeInTheDocument()
  })

  it('names a loop by its title where it carries one', () => {
    // No ports: what is read here is the name the picker gives a loop, not what it walks.
    const titled: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { title: 'Per variation' },
    }
    installGraph(DOCUMENT, { nodes: [titled, END, TEXT], edges: [], inputKeys: [] })
    show('end1')

    expect(screen.getByRole('option', { name: 'Per variation' })).toBeInTheDocument()
  })

  /**
   * A `<select>` whose value matches no option has `selectedIndex === -1` and renders BLANK: the
   * panel would read "no loop" over an end that names one, and the next change would overwrite it
   * unseen. `ModelFamilySettings.withStored` closes the same trap.
   */
  it('shows the loop an end names even after that loop is gone', () => {
    installGraph(DOCUMENT, {
      nodes: [forEachEndNode('end1', 'gone'), TEXT],
      edges: [],
      inputKeys: [],
    })
    show('end1')

    expect(screen.getByLabelText('Boucle fermée')).toHaveValue('gone')
  })

  it('offers nothing of the sort on a node that is not the end of a loop', () => {
    show('forEach1')

    expect(screen.queryByLabelText('Boucle fermée')).not.toBeInTheDocument()
  })
})
