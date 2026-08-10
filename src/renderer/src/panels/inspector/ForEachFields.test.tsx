import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@shared/domain/graph'
import { forEachEndNode, forEachNode, textNode } from '@/engines/graph/graph-fixtures'
import { loopInputId, loopOutputId } from '@/engines/graph/handles'
import { installGraph } from '@/stores/graph-fixtures'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

const DOCUMENT = 'graph-1'

const LOOP: GraphNode = forEachNode('forEach1', ['image'])
const END: GraphNode = forEachEndNode('end1', 'forEach1')
const TEXT: GraphNode = textNode('text1')

/** A model reading the item of the first list — the port a removed list takes with it. */
const READS_ITEM: GraphEdge = {
  id: 'e1',
  source: 'model1',
  target: 'forEach1',
  sourceHandle: 'model1-source-prompt',
  targetHandle: loopOutputId('forEach1', 0),
}

beforeEach(() => {
  installGraph(DOCUMENT, { nodes: [LOOP, END, TEXT], edges: [], inputKeys: [] })
})

const nodeOf = (id: string): GraphNode | undefined =>
  graphOf(useGraphs.getState(), DOCUMENT).nodes.find(node => node.id === id)

const inputs = (): readonly string[] =>
  (nodeOf('forEach1')?.data.inputHandles ?? []).map(handle => handle.id)

const outputs = (): readonly (string | undefined)[] =>
  (nodeOf('forEach1')?.data.outputHandles ?? []).map(handle => handle.id)

const types = (): readonly (string | undefined)[] =>
  (nodeOf('forEach1')?.data.outputHandles ?? []).map(handle => handle.type)

function Live({ id }: { id: string }) {
  const node = useGraphs(state => graphOf(state, DOCUMENT).nodes.find(entry => entry.id === id))
  return node ? <GraphNodeInspector documentId={DOCUMENT} node={node} /> : null
}

const show = (id: string): void => {
  render(<Live id={id} />)
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
    installGraph(DOCUMENT, { nodes: [LOOP, END, TEXT], edges: [READS_ITEM], inputKeys: [] })
    show('forEach1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette liste/ }))

    expect(graphOf(useGraphs.getState(), DOCUMENT).edges).toEqual([])
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
