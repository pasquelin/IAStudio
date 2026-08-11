import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  CONDITIONAL_PORT,
  nodeById,
  type GraphConditionBlock,
  type GraphEdge,
  type GraphNode,
} from '@shared/domain/graph'
import { conditionBlocksOf } from '@/engines/graph/conditions'
import { edgeBetween } from '@/engines/graph/connect'
import {
  branchNode,
  graphOf as graphStateOf,
  modelNode,
  textNode,
  wire,
} from '@/engines/graph/graph-fixtures'
import { handleId, inputHandlesOf } from '@/engines/graph/handles'
import { installGraph } from '@/stores/graph-fixtures'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

const DOCUMENT = 'graph-1'

/**
 * The three nodes and the wires between them, taken from the fabric rather than sketched: this
 * suite's subject is what the panel WRITES on a branch, and a hand-written branch here carried no
 * conditional port at all while the very edge below named one.
 */
const TEXT = textNode('text1', 'a small grey rock')

const MODEL = modelNode('model1')

const TESTS_TEXT: GraphConditionBlock = {
  logic: 'and',
  conditions: [{ field: 'text1', operator: 'equals' }],
}

const BRANCH: GraphNode = branchNode('ifElse1', [TESTS_TEXT])

/** Scenario's edge points from CONSUMER to PROVIDER: the branch reads the text node. */
const FED: GraphEdge = wire('ifElse1', CONDITIONAL_PORT, 'text1', 'prompt')

/** A model reading the FIRST branch, which is the port a removed block takes with it. */
const READS_CASE1: GraphEdge = wire('model1', 'prompt', 'ifElse1', 'case1')

/**
 * A branch off a FILE, whose ports ARE this suite's subject: named the document's own way, which
 * the converter matches by index. Its conditional port comes from the fabric all the same — a
 * branch carrying none is one no wire could reach, and writing it out is how this file lost it.
 */
const importedBranch = (blocks: readonly GraphConditionBlock[]): GraphNode => ({
  id: 'ifElse1',
  type: 'ifElse',
  position: { x: 0, y: 0 },
  data: {
    conditionBlocks: blocks,
    inputHandles: inputHandlesOf(branchNode('ifElse1', [])),
    outputHandles: [
      { id: 'ifElse1-out-0', name: 'a' },
      { id: 'ifElse1-out-1', name: 'b' },
    ],
  },
})

beforeEach(() => {
  installGraph(DOCUMENT, graphStateOf([TEXT, BRANCH, MODEL], [FED]))
})

const branch = (): GraphNode | null => nodeById(graphOf(useGraphs.getState(), DOCUMENT), 'ifElse1')

const blocks = () => {
  const node = branch()
  return node ? conditionBlocksOf(node) : []
}

const ports = (): readonly string[] => (branch()?.data.outputHandles ?? []).map(handle => handle.id)

function Live({ id }: { id: string }) {
  const node = useGraphs(state => nodeById(graphOf(state, DOCUMENT), id))
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
    installGraph(DOCUMENT, graphStateOf([TEXT, BRANCH, MODEL], [FED, READS_CASE1]))
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette branche/ }))

    const edges = graphOf(useGraphs.getState(), DOCUMENT).edges
    expect(edges.map(edge => edge.id)).toEqual([FED.id])
  })

  /**
   * One entry, so ⌘Z never gives back the blocks without the ports that read them — and the port
   * count is asserted BOTH ways round: only checking the state after the undo let a `write` that
   * never touched the ports pass, since they were already what the test expected.
   */
  it('undoes the blocks and the ports together', async () => {
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une branche/ }))
    expect(ports()).toHaveLength(3)

    useGraphs.getState().undo(DOCUMENT)

    expect(blocks()).toHaveLength(1)
    expect(ports()).toEqual(['ifElse1-target-case1', 'ifElse1-target-else'])
  })

  /**
   * The defect two reviews found: dropping a branch that is not the last one used to REGENERATE
   * the port list, so the wire of the dropped branch stayed on `case1` and fed whichever branch
   * slid into its place, while the wire of that branch was cut. No error, no warning.
   */
  it('re-aims nothing when a middle branch is dropped: each wire follows its own branch', async () => {
    const three: GraphNode = branchNode('ifElse1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'b' }] },
    ])
    const readsCase2: GraphEdge = wire('model1', 'mask', 'ifElse1', 'case2')
    installGraph(DOCUMENT, graphStateOf([TEXT, three, MODEL], [FED, READS_CASE1, readsCase2]))
    show('ifElse1')

    const [first] = screen.getAllByRole('button', { name: /Supprimer cette branche/ })
    if (!first) throw new Error('no branch to remove')
    await userEvent.click(first)

    // The surviving block is the SECOND one, and the wire that read it still reads it: its port
    // kept its id and slid to index 0 with it.
    expect(blocks()[0]?.conditions[0]?.value).toBe('b')
    expect(ports()).toEqual(['ifElse1-target-case2', 'ifElse1-target-else'])

    const edges = graphOf(useGraphs.getState(), DOCUMENT).edges
    expect(edges.map(edge => edge.id).sort()).toEqual([FED.id, readsCase2.id].sort())
  })

  /**
   * A node the editor never made carries ports of a file's own naming — the converter matches them
   * by INDEX, so nothing obliges a document to our ids. Editing a VALUE used to rewrite the whole
   * handle list, which cut every wire into the node.
   */
  it('leaves the ports of an imported node alone while a value is typed', async () => {
    const theirs: GraphNode = importedBranch([TESTS_TEXT])
    const readsTheirs: GraphEdge = edgeBetween(
      'model1',
      handleId('model1', 'source', 'prompt'),
      'ifElse1',
      'ifElse1-out-0',
    )
    installGraph(DOCUMENT, graphStateOf([TEXT, theirs, MODEL], [FED, readsTheirs]))
    show('ifElse1')
    await userEvent.type(screen.getByLabelText('Valeur comparée'), 'rock')

    expect(ports()).toEqual(['ifElse1-out-0', 'ifElse1-out-1'])
    expect(graphOf(useGraphs.getState(), DOCUMENT).edges.map(edge => edge.id)).toEqual([
      FED.id,
      readsTheirs.id,
    ])
  })

  /** And an added branch slots its port in among theirs rather than replacing the lot. */
  it('inserts a new port among the ones a file wrote', async () => {
    const theirs: GraphNode = importedBranch([{ logic: 'and', conditions: [] }])
    installGraph(DOCUMENT, graphStateOf([TEXT, theirs, MODEL], [FED]))
    show('ifElse1')
    await userEvent.click(screen.getByRole('button', { name: /Ajouter une branche/ }))

    expect(ports()).toEqual(['ifElse1-out-0', 'ifElse1-target-case2', 'ifElse1-out-1'])
  })
})

describe('a condition whose field the wires do not offer', () => {
  /**
   * A `<select>` whose value matches no option has `selectedIndex === -1` and renders BLANK — the
   * panel would read "nothing is tested" over a condition that tests something, and the next
   * change would overwrite it unseen. `ModelFamilySettings.withStored` closes the same trap.
   */
  it('shows the field a condition names even when nothing feeds it', () => {
    const orphan: GraphNode = branchNode('ifElse1', [
      { logic: 'and', conditions: [{ field: 'text1_output', operator: 'equals' }] },
    ])
    installGraph(DOCUMENT, graphStateOf([TEXT, orphan], []))
    show('ifElse1')

    expect(screen.getByLabelText('Ce qui est testé')).toHaveValue('text1_output')
  })
})
