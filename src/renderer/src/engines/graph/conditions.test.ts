import { describe, expect, it } from 'vitest'
import type { GraphConditionBlock, GraphNode, GraphState } from '@shared/domain/graph'
import {
  addCondition,
  addedBranch,
  conditionBlocksOf,
  conditionFieldsOf,
  removeCondition,
  removedBranch,
  setBlockLogic,
  setCondition,
} from './conditions'
import { parseGraph } from './serialize'

/**
 * Read the way a file is, and that is the point rather than convenience: `parseGraph` keeps `data`
 * exactly as it found it, so this is the only honest way to hand the reader what a hand-edited
 * document holds — and it needs no cast to do it.
 */
function readBlocks(held: unknown): readonly GraphConditionBlock[] {
  const graph = parseGraph({
    nodes: [
      { id: 'ifElse1', type: 'ifElse', position: { x: 0, y: 0 }, data: { conditionBlocks: held } },
    ],
  })
  const node = graph.nodes[0]

  return node ? conditionBlocksOf(node) : []
}

const first = (held: unknown) => readBlocks(held)[0]?.conditions[0]

describe('reading the conditions off a node', () => {
  it('reads nothing off a node of another type', () => {
    const node: GraphNode = { id: 'text1', type: 'text', position: { x: 0, y: 0 }, data: {} }
    expect(conditionBlocksOf(node)).toEqual([])
  })

  it('keeps a block Scenario would compile', () => {
    const block = {
      logic: 'or',
      conditions: [{ field: 'text1', operator: 'contains', value: 'a' }],
    }
    expect(readBlocks([block])).toEqual([block])
  })

  /**
   * `parseGraph` validates the node and not its `data`, so every one of these reaches the reader
   * off a file. Repaired rather than dropped, a branch would show one thing and compile another.
   */
  it('drops what a file can hold and the converter cannot read', () => {
    expect(readBlocks('nonsense')).toEqual([])
    expect(readBlocks([{ logic: 'maybe', conditions: 'none' }])).toEqual([
      { logic: 'and', conditions: [] },
    ])
    expect(first([{ conditions: [{ operator: 'startsWith', field: 'text1' }] }])).toEqual({
      field: 'text1',
      operator: 'equals',
    })
    expect(readBlocks([{ conditions: ['a condition', null, 7] }])).toEqual([
      { logic: 'and', conditions: [] },
    ])
  })

  /**
   * A block is a POSITION, and that is why an unreadable one is kept rather than dropped: the
   * converter reads `conditionBlocks` raw and calls every port past the LAST block the else.
   * Dropped, the screen would show one branch where the converter counts two — and the port the
   * panel labels "otherwise" would compile as case 3.
   */
  it('keeps an unreadable block, empty, rather than shifting the ones after it', () => {
    const readable = { logic: 'and', conditions: [{ field: 'text1', operator: 'equals' }] }

    expect(readBlocks([null, readable])).toEqual([{ logic: 'and', conditions: [] }, readable])
    expect(readBlocks(['block', 7])).toHaveLength(2)
  })

  /**
   * `between` compiles to `false` unless its value is a pair, and every other operator formats an
   * array as a CEL list — which `equals` then compares a string against, false forever.
   */
  it('keeps a value only in the shape its operator reads', () => {
    expect(first([{ conditions: [{ operator: 'between', value: ['1', '9'] }] }])).toEqual({
      operator: 'between',
      value: ['1', '9'],
    })
    expect(first([{ conditions: [{ operator: 'between', value: '1' }] }])).toEqual({
      operator: 'between',
    })
    // A pair is TWO strings: three of them, or one of them a number, is not a range the
    // converter compiles — it answers `false` and the branch can never be taken.
    expect(first([{ conditions: [{ operator: 'between', value: ['1', 9] }] }])).toEqual({
      operator: 'between',
    })
    expect(first([{ conditions: [{ operator: 'between', value: ['1', '2', '3'] }] }])).toEqual({
      operator: 'between',
    })
    expect(first([{ conditions: [{ operator: 'equals', value: ['a', 'b'] }] }])).toEqual({
      operator: 'equals',
    })
    expect(first([{ conditions: [{ operator: 'isEmpty', value: 'a' }] }])).toEqual({
      operator: 'isEmpty',
    })
  })
})

describe('adding and dropping a branch', () => {
  const branch = (blocks: unknown, handles: unknown): GraphNode => {
    const graph = parseGraph({
      nodes: [
        {
          id: 'ifElse1',
          type: 'ifElse',
          position: { x: 0, y: 0 },
          data: { conditionBlocks: blocks, outputHandles: handles },
        },
      ],
    })
    const node = graph.nodes[0]
    if (!node) throw new Error('the fixture lost its node')
    return node
  }

  const ids = (handles: readonly { id: string }[]): readonly string[] =>
    handles.map(handle => handle.id)

  const ONE = [{ logic: 'and', conditions: [] }]
  const OURS = [
    { id: 'ifElse1-target-case1', name: 'case1' },
    { id: 'ifElse1-target-else', name: 'else' },
  ]

  it('adds a block, and its port where the else begins', () => {
    const added = addedBranch(branch(ONE, OURS))

    expect(added.conditionBlocks).toHaveLength(2)
    expect(ids(added.outputHandles)).toEqual([
      'ifElse1-target-case1',
      'ifElse1-target-case2',
      'ifElse1-target-else',
    ])
  })

  /**
   * The converter matches an `ifElse` port by its INDEX, never by its spelling — so a file names
   * them as it likes, and rebuilding the list would rename every port and cut every wire into it.
   */
  it('keeps the ports a file wrote in its own words', () => {
    const theirs = [
      { id: 'ifElse1-out-0', name: 'a' },
      { id: 'ifElse1-out-1', name: 'b' },
    ]
    const added = addedBranch(branch(ONE, theirs))

    expect(ids(added.outputHandles)).toEqual([
      'ifElse1-out-0',
      'ifElse1-target-case2',
      'ifElse1-out-1',
    ])
  })

  /** A node that came with none still needs somewhere to wire what no branch matched. */
  it('gives an else to a node that carries no port at all', () => {
    const added = addedBranch(branch([], []))

    expect(added.conditionBlocks).toHaveLength(1)
    expect(added.outputHandles).toHaveLength(2)
  })

  /** Ours in spelling only: a file may already hold the id this one would have taken. */
  it('never hands out an id a handle already carries', () => {
    const clashing = [{ id: 'ifElse1-target-case2', name: 'mine' }, ...OURS]
    const added = addedBranch(branch(ONE, clashing))

    expect(new Set(ids(added.outputHandles)).size).toBe(added.outputHandles.length)
  })

  /**
   * Dropping a branch that is not the last one: its port goes, the ones after it slide up KEEPING
   * their ids, so the wires on them follow the block that slid up with them. Regenerating the list
   * left the wire of the dropped branch on `case1` — re-routed to the branch that took its place,
   * with no error anywhere.
   */
  it('takes the port of the dropped branch and leaves the others their ids', () => {
    const three = [
      { logic: 'and', conditions: [{ field: 'a', operator: 'equals' }] },
      { logic: 'and', conditions: [{ field: 'b', operator: 'equals' }] },
      { logic: 'and', conditions: [{ field: 'c', operator: 'equals' }] },
    ]
    const handles = [
      { id: 'ifElse1-target-case1', name: 'case1' },
      { id: 'ifElse1-target-case2', name: 'case2' },
      { id: 'ifElse1-target-case3', name: 'case3' },
      { id: 'ifElse1-target-else', name: 'else' },
    ]

    const dropped = removedBranch(branch(three, handles), 0)

    expect(dropped.conditionBlocks.map(block => block.conditions[0]?.field)).toEqual(['b', 'c'])
    expect(ids(dropped.outputHandles)).toEqual([
      'ifElse1-target-case2',
      'ifElse1-target-case3',
      'ifElse1-target-else',
    ])
  })
})

describe('what a condition may test', () => {
  /**
   * Scenario's edge points from CONSUMER to PROVIDER, so what feeds the branch is the edges whose
   * `source` is the branch. Read the intuitive way the picker offers what the branch feeds.
   */
  it('offers the nodes wired into the branch, once each', () => {
    const graph: GraphState = {
      nodes: [],
      edges: [
        { id: 'e1', source: 'ifElse1', target: 'text1' },
        { id: 'e2', source: 'ifElse1', target: 'text1' },
        { id: 'e3', source: 'ifElse1', target: 'asset1' },
        { id: 'e4', source: 'model1', target: 'ifElse1' },
      ],
      inputKeys: [],
    }

    expect(conditionFieldsOf(graph, 'ifElse1')).toEqual(['text1', 'asset1'])
  })
})

describe('editing the conditions', () => {
  const one: readonly GraphConditionBlock[] = [
    { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a' }] },
  ]

  it('changes how one block combines', () => {
    expect(setBlockLogic(one, 0, 'or')[0]?.logic).toBe('or')
  })

  it('adds and removes a condition inside one block', () => {
    const grown = addCondition(one, 0)
    expect(grown[0]?.conditions).toHaveLength(2)
    expect(removeCondition(grown, 0, 1)).toEqual(one)
  })

  /** A branch just added holds no field at all, and choosing an operator must not invent one. */
  it('leaves a condition fieldless while nothing has been chosen', () => {
    const blank: readonly GraphConditionBlock[] = [
      { logic: 'and', conditions: [{ operator: 'equals' }] },
    ]

    expect(setCondition(blank, 0, 0, { operator: 'isEmpty' })[0]?.conditions[0]).toEqual({
      operator: 'isEmpty',
    })
  })

  it('writes what was changed and leaves the rest', () => {
    expect(setCondition(one, 0, 0, { field: 'asset1' })[0]?.conditions[0]).toEqual({
      field: 'asset1',
      operator: 'equals',
      value: 'a',
    })
  })

  /**
   * The neighbours, untouched — and a block IS a branch, so a write that reached the wrong one
   * would re-route an output nobody edited.
   */
  it('touches neither the other branch nor the other condition', () => {
    const two: readonly GraphConditionBlock[] = [
      {
        logic: 'and',
        conditions: [
          { field: 'text1', operator: 'equals', value: 'a' },
          { field: 'asset1', operator: 'isEmpty' },
        ],
      },
      { logic: 'or', conditions: [{ field: 'text2', operator: 'contains', value: 'b' }] },
    ]

    const edited = setCondition(two, 0, 1, { operator: 'isNotEmpty' })

    expect(edited[0]?.conditions[0]).toEqual(two[0]?.conditions[0])
    expect(edited[0]?.conditions[1]).toEqual({ field: 'asset1', operator: 'isNotEmpty' })
    expect(edited[1]).toEqual(two[1])
  })

  /**
   * The value a `between` left behind would be a CEL list under `equals`, compared against a
   * string — a branch that reads right in the panel and can never be taken.
   */
  it('drops a value the new operator would read differently', () => {
    const ranged = setCondition(one, 0, 0, { operator: 'between', value: ['1', '9'] })
    expect(setCondition(ranged, 0, 0, { operator: 'equals' })[0]?.conditions[0]).toEqual({
      field: 'text1',
      operator: 'equals',
    })
    expect(setCondition(one, 0, 0, { operator: 'isEmpty' })[0]?.conditions[0]).toEqual({
      field: 'text1',
      operator: 'isEmpty',
    })
  })
})
