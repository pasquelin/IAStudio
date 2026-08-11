import { describe, expect, it } from 'vitest'
import {
  APPROVAL_PORT,
  approvalsOf,
  CONDITIONAL_PORT,
  EMPTY_GRAPH,
  handleId,
  isRunnable,
  nodeById,
  silentNodesOf,
  type GraphEdge,
  type GraphNode,
  type GraphNodeType,
  type GraphState,
} from './graph'

const node = (id: string, type: GraphNodeType = 'forEach'): GraphNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {},
})

const graph = (nodes: readonly GraphNode[], edges: readonly GraphEdge[] = []): GraphState => ({
  ...EMPTY_GRAPH,
  nodes,
  edges,
})

/**
 * The wire an approval guards through, spelled the way the converter matches it. Written out here
 * rather than taken from `engines/graph/graph-fixtures.ts`: `src/shared` is compiled by the Node
 * pass, which knows no `@/` alias — reaching for the renderer's fixtures would not typecheck.
 */
const guards = (approval: string, guarded: string): GraphEdge => ({
  id: `${approval}--guards--${guarded}`,
  source: approval,
  target: guarded,
  sourceHandle: handleId(approval, 'source', APPROVAL_PORT),
})

describe('nodeById', () => {
  it('answers with the node an id names', () => {
    expect(nodeById(graph([node('a'), node('b')]), 'b')?.id).toBe('b')
  })

  // `null` and not `undefined`, as `nodeById` on the scene side already answers
  // (`engines/scene/scene-state.ts`). No file imports both — this is one habit, not one function.
  it('answers null rather than undefined when nothing carries the id', () => {
    expect(nodeById(graph([node('a')]), 'b')).toBeNull()
    expect(nodeById(EMPTY_GRAPH, 'a')).toBeNull()
  })

  // A selection reads `ids[0]`, which the compiler types as possibly missing: widening the
  // signature is what keeps every caller from writing `?? ''` back.
  it('answers null for a missing id rather than refusing it', () => {
    expect(nodeById(graph([node('a')]), undefined)).toBeNull()
  })
})

describe('reading the approvals of a graph', () => {
  it('names the node an approval guards', () => {
    const held = graph(
      [node('m1', 'model'), node('approval1', 'approval')],
      [guards('approval1', 'm1')],
    )

    expect([...approvalsOf(held)]).toEqual([['m1', 'approval1']])
  })

  // WITH an ordinary wire in it, which is the half that matters: a graph with no edge at all
  // would answer nothing whatever the reader did with the ones it has.
  it('answers nothing for a graph with no approval in it', () => {
    const held = graph(
      [node('text1', 'text'), node('m1', 'model')],
      [
        {
          id: 'e1',
          source: 'm1',
          target: 'text1',
          sourceHandle: handleId('m1', 'source', 'prompt'),
        },
      ],
    )

    expect(approvalsOf(held).size).toBe(0)
  })

  /**
   * An approval dropped on the canvas and left unwired guards nothing at all: it compiles away,
   * and a run stopping on it would be a question about a node the user never named.
   */
  it('ignores an approval wired to nothing', () => {
    expect(approvalsOf(graph([node('m1', 'model'), node('approval1', 'approval')])).size).toBe(0)
  })

  /**
   * The port id is the whole of what the converter matches — it builds the string itself — so a
   * wire leaving an approval through anything else is not an approval wire.
   */
  it('ignores a wire leaving an approval through another port', () => {
    const held = graph(
      [node('m1', 'model'), node('approval1', 'approval')],
      [
        {
          id: 'e1',
          source: 'approval1',
          target: 'm1',
          sourceHandle: handleId('approval1', 'source', CONDITIONAL_PORT),
        },
      ],
    )

    expect(approvalsOf(held).size).toBe(0)
  })

  /**
   * `parseGraph` keeps an edge whose ends a file names and the graph no longer holds — the plan
   * filters those, and the converter checks the guarded node exists before recording anything.
   * Left in, the map would claim a guard on a node nobody can see.
   */
  it('ignores a guard on a node the graph no longer holds', () => {
    const held = graph([node('approval1', 'approval')], [guards('approval1', 'm1')])

    expect(approvalsOf(held).size).toBe(0)
  })

  it('takes the first wire when an approval names two nodes', () => {
    const held = graph(
      [node('m1', 'model'), node('m2', 'model'), node('approval1', 'approval')],
      [guards('approval1', 'm1'), guards('approval1', 'm2')],
    )

    expect([...approvalsOf(held)]).toEqual([['m1', 'approval1']])
  })

  /** Transcribed from the converter, which overwrites its map: the last node in order wins. */
  it('keeps the last approval when two of them guard one node', () => {
    const held = graph(
      [node('m1', 'model'), node('approval1', 'approval'), node('approval2', 'approval')],
      [guards('approval1', 'm1'), guards('approval2', 'm1')],
    )

    expect([...approvalsOf(held)]).toEqual([['m1', 'approval2']])
  })
})

describe('the nodes a run passes over without a word', () => {
  it('holds a sticky note, whatever it is wired to', () => {
    const held = graph(
      [node('note1', 'stickyNote'), node('m1', 'model')],
      [
        {
          id: 'e1',
          source: 'm1',
          target: 'note1',
          sourceHandle: handleId('m1', 'source', 'prompt'),
        },
      ],
    )

    expect([...silentNodesOf(held)]).toEqual(['note1'])
  })

  /**
   * The half a hand-written list of TYPES could never carry: whether an approval is silent is a
   * fact about its WIRES. The executor has always read it this way — the button did not.
   */
  it('holds an approval guarding nobody, and not one that guards', () => {
    const held = graph(
      [node('m1', 'model'), node('approval1', 'approval'), node('approval2', 'approval')],
      [guards('approval1', 'm1')],
    )

    expect([...silentNodesOf(held)]).toEqual(['approval2'])
  })

  /**
   * Silence travels back up the chain: guarding a note is asking about a node that produces
   * nothing, and the answer would be put to nobody's benefit.
   */
  it('holds an approval that guards a sticky note', () => {
    const held = graph(
      [node('note1', 'stickyNote'), node('approval1', 'approval')],
      [guards('approval1', 'note1')],
    )

    expect([...silentNodesOf(held)].sort()).toEqual(['approval1', 'note1'])
  })

  /**
   * Two links of the same chain, and the reason the walk is a fixed point rather than one pass:
   * `approval2` only becomes silent once `approval1` has, whatever order the nodes are in.
   */
  it('holds a chain of approvals whose end guards a note', () => {
    const held = graph(
      [node('approval2', 'approval'), node('approval1', 'approval'), node('note1', 'stickyNote')],
      [guards('approval2', 'approval1'), guards('approval1', 'note1')],
    )

    expect([...silentNodesOf(held)].sort()).toEqual(['approval1', 'approval2', 'note1'])
  })

  /** A cycle is something the plan paints, and painting is reporting — so neither is silent. */
  it('holds neither of two approvals guarding each other', () => {
    const held = graph(
      [node('approval1', 'approval'), node('approval2', 'approval')],
      [guards('approval1', 'approval2'), guards('approval2', 'approval1')],
    )

    expect(silentNodesOf(held).size).toBe(0)
  })

  // Both reported `done` by the executor, and both were on the list of silent TYPES this replaces.
  it('holds neither a text node nor an asset node', () => {
    expect(silentNodesOf(graph([node('text1', 'text'), node('asset1', 'asset')])).size).toBe(0)
  })
})

describe('whether a graph is worth running', () => {
  it('refuses an empty graph', () => {
    expect(isRunnable(EMPTY_GRAPH)).toBe(false)
  })

  /**
   * The defect this predicate was written wrong for: the Run button stayed lit on a graph made of
   * a note and an approval guarding nobody, and the run reported nothing at all.
   */
  it('refuses a graph of a note and an approval guarding nobody', () => {
    const held = graph([node('note1', 'stickyNote'), node('approval1', 'approval')])

    expect(isRunnable(held)).toBe(false)
  })

  it('accepts a graph whose approval guards something', () => {
    const held = graph(
      [node('m1', 'model'), node('approval1', 'approval')],
      [guards('approval1', 'm1')],
    )

    expect(isRunnable(held)).toBe(true)
  })

  // A text node reports `done`, so pressing Run over one is not pressing Run over nothing.
  it('accepts a graph of a single text node', () => {
    expect(isRunnable(graph([node('text1', 'text')]))).toBe(true)
  })

  /**
   * The other half of the same defect: guarding a note is a question about a node that produces
   * nothing, so the run walks past it and the button must not offer it.
   */
  it('refuses a graph whose only approval guards a note', () => {
    const held = graph(
      [node('note1', 'stickyNote'), node('approval1', 'approval')],
      [guards('approval1', 'note1')],
    )

    expect(isRunnable(held)).toBe(false)
  })
})
