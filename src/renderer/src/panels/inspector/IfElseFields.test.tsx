import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@shared/domain/graph'
import { conditionBlocksOf } from '@/engines/graph/conditions'
import { installGraph } from '@/stores/graph-fixtures'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

const DOCUMENT = 'graph-1'

const TEXT: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { value: 'a small grey rock' },
}

const BRANCH: GraphNode = {
  id: 'ifElse1',
  type: 'ifElse',
  position: { x: 40, y: 0 },
  data: {
    conditionBlocks: [{ logic: 'and', conditions: [{ field: 'text1', operator: 'equals' }] }],
    outputHandles: [
      { id: 'ifElse1-target-case1', name: 'case1' },
      { id: 'ifElse1-target-else', name: 'else' },
    ],
  },
}

/** Scenario's edge points from CONSUMER to PROVIDER: the branch reads the text node. */
const FED: GraphEdge = {
  id: 'e1',
  source: 'ifElse1',
  target: 'text1',
  sourceHandle: 'ifElse1-source-conditional',
  targetHandle: 'text1-target-prompt',
}

/** A model reading the FIRST branch, which is the port a removed block takes with it. */
const READS_CASE1: GraphEdge = {
  id: 'e2',
  source: 'model1',
  target: 'ifElse1',
  sourceHandle: 'model1-source-prompt',
  targetHandle: 'ifElse1-target-case1',
}

const MODEL: GraphNode = { id: 'model1', type: 'model', position: { x: 90, y: 0 }, data: {} }

beforeEach(() => {
  installGraph(DOCUMENT, { nodes: [TEXT, BRANCH, MODEL], edges: [FED], inputKeys: [] })
})

const branch = (): GraphNode | undefined =>
  graphOf(useGraphs.getState(), DOCUMENT).nodes.find(node => node.id === 'ifElse1')

const blocks = () => {
  const node = branch()
  return node ? conditionBlocksOf(node) : []
}

const ports = (): readonly string[] => (branch()?.data.outputHandles ?? []).map(handle => handle.id)

function Live({ id }: { id: string }) {
  const node = useGraphs(state => graphOf(state, DOCUMENT).nodes.find(entry => entry.id === id))
  return node ? <GraphNodeInspector documentId={DOCUMENT} node={node} /> : null
}

const show = (id: string): void => {
  render(<Live id={id} />)
}

describe('the conditions of a branch', () => {
  it('offers nothing of the sort on a node that does not fork', () => {
    show('text1')

    expect(screen.queryByLabelText('Comparaison')).not.toBeInTheDocument()
  })

  /**
   * The converter resolves a field to the node it names, and answers `undefined` for one that
   * feeds nothing — the whole condition then drops out of the flow, silently. So the picker
   * offers what is wired in, and nothing else.
   */
  it('offers the nodes wired into the branch, and the option of none', () => {
    show('ifElse1')
    const field = screen.getByLabelText('Ce qui est testé')

    expect(field).toHaveValue('text1')
    expect(screen.getByRole('option', { name: 'Rien' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'model1' })).not.toBeInTheDocument()
  })

  it('writes the value a condition compares against', async () => {
    show('ifElse1')
    await userEvent.type(screen.getByLabelText('Valeur comparée'), 'rock')

    expect(blocks()[0]?.conditions[0]).toEqual({
      field: 'text1',
      operator: 'equals',
      value: 'rock',
    })
  })

  /** A typed word is ONE undo entry, as every other field of the inspector is. */
  it('collapses a typed value into a single history entry', async () => {
    show('ifElse1')
    const before = historyOf(useGraphs.getState(), DOCUMENT).past.length
    await userEvent.type(screen.getByLabelText('Valeur comparée'), 'rock')

    expect(historyOf(useGraphs.getState(), DOCUMENT).past.length).toBe(before + 1)
  })

  it('drops the value field for an operator that reads none', async () => {
    show('ifElse1')
    await userEvent.selectOptions(screen.getByLabelText('Comparaison'), 'isEmpty')

    expect(screen.queryByLabelText('Valeur comparée')).not.toBeInTheDocument()
    expect(blocks()[0]?.conditions[0]).toEqual({ field: 'text1', operator: 'isEmpty' })
  })

  /**
   * `between` compiles to `false` unless it holds a PAIR of numbers, so both bounds are written
   * together — one alone would read complete in the panel and never fire.
   */
  it('writes both bounds of a range', async () => {
    show('ifElse1')
    await userEvent.selectOptions(screen.getByLabelText('Comparaison'), 'between')
    await userEvent.type(screen.getByLabelText('Borne basse'), '1')
    await userEvent.type(screen.getByLabelText('Borne haute'), '9')

    expect(blocks()[0]?.conditions[0]).toEqual({
      field: 'text1',
      operator: 'between',
      value: ['1', '9'],
    })
  })

  it('combines two conditions of one branch, and says how from the second on', async () => {
    show('ifElse1')
    expect(
      screen.queryByLabelText('Combinaison avec la condition précédente'),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ajouter une condition/ }))
    await userEvent.selectOptions(
      screen.getByLabelText('Combinaison avec la condition précédente'),
      'or',
    )

    expect(blocks()[0]?.logic).toBe('or')
    expect(blocks()[0]?.conditions).toHaveLength(2)
  })

  it('removes one condition and leaves the branch', async () => {
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette condition/ }))

    expect(blocks()).toHaveLength(1)
    expect(blocks()[0]?.conditions).toEqual([])
  })
})

describe('the outputs a branch carries', () => {
  /**
   * A block IS an output: the converter gives block `i` the case value `i + 2` and reads every
   * handle past the last block as the else. Added without its port, the new branch would compile
   * to a case nothing can leave by.
   */
  it('grows an output with every branch added', async () => {
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une branche/ }))

    expect(blocks()).toHaveLength(2)
    expect(ports()).toEqual(['ifElse1-target-case1', 'ifElse1-target-case2', 'ifElse1-target-else'])
  })

  it('takes the output away with the branch, and the else stays', async () => {
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette branche/ }))

    expect(blocks()).toEqual([])
    expect(ports()).toEqual(['ifElse1-target-else'])
  })

  /**
   * An edge aimed at a port no node carries is rejected by `validateWorkflowFlow` at export, far
   * from the gesture that caused it — which is why removing a branch cuts what read it.
   */
  it('cuts the wire that left by a removed branch', async () => {
    installGraph(DOCUMENT, {
      nodes: [TEXT, BRANCH, MODEL],
      edges: [FED, READS_CASE1],
      inputKeys: [],
    })
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette branche/ }))

    const edges = graphOf(useGraphs.getState(), DOCUMENT).edges
    expect(edges.map(edge => edge.id)).toEqual(['e1'])
  })

  /** One entry, so ⌘Z never gives back the blocks without the ports that read them. */
  it('undoes the blocks and the ports together', async () => {
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une branche/ }))
    useGraphs.getState().undo(DOCUMENT)

    expect(blocks()).toHaveLength(1)
    expect(ports()).toEqual(['ifElse1-target-case1', 'ifElse1-target-else'])
  })
})
