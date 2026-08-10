import { describe, expect, it } from 'vitest'
import type { GraphConditionBlock, GraphNode, GraphState } from '@shared/domain/graph'
import {
  addCondition,
  addConditionBlock,
  conditionBlocksOf,
  conditionFieldsOf,
  ifElseOutputs,
  removeCondition,
  removeConditionBlock,
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
    expect(readBlocks([null, 3, 'block'])).toEqual([])
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

describe('the ports a branch carries', () => {
  /**
   * The converter gives block `i` the case value `i + 2` and reads every handle past the last
   * block as the else — by INDEX, never by name. One port too few and the else steals a branch.
   */
  it('carries one port per block, then the else', () => {
    expect(ifElseOutputs('ifElse1', 2)).toEqual([
      { id: 'ifElse1-target-case1', name: 'case1' },
      { id: 'ifElse1-target-case2', name: 'case2' },
      { id: 'ifElse1-target-else', name: 'else' },
    ])
  })

  it('carries the else alone when nothing is asked', () => {
    expect(ifElseOutputs('ifElse1', 0)).toEqual([{ id: 'ifElse1-target-else', name: 'else' }])
  })

  /** Untyped both sides: a branch passes on whatever reached it, pictures included. */
  it('types neither end', () => {
    for (const handle of ifElseOutputs('ifElse1', 1)) expect(handle.type).toBeUndefined()
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

  it('adds a block holding one blank condition', () => {
    expect(addConditionBlock([])).toEqual([{ logic: 'and', conditions: [{ operator: 'equals' }] }])
  })

  it('removes the block that was asked for, and only it', () => {
    const two = addConditionBlock(one)
    expect(removeConditionBlock(two, 0)).toEqual([
      { logic: 'and', conditions: [{ operator: 'equals' }] },
    ])
    expect(removeConditionBlock(two, 1)).toEqual(one)
  })

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
    const blank = addConditionBlock([])

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
