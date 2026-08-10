import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_NODE_TYPES,
  type GraphEdge,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { compileGraph, toEditorFlow } from './workflow-compile'

const handleId = (nodeId: string, side: 'source' | 'target', field: string): string =>
  `${nodeId}-${side}-${field}`

/**
 * As `createNode` builds one, handle id included — and that is not a detail. A text node's output
 * is `<id>-target-PROMPT`, named `output`: the field is not the name. Written any other way the
 * converter simply does not match the wire, the generator falls back to its form, and a test whose
 * two prompts happened to be the same word would call that a resolution.
 */
function textNode(id: string, value: string): GraphNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: {
      value,
      outputHandles: [{ id: handleId(id, 'target', 'prompt'), name: 'output', type: 'text' }],
    },
  }
}

function modelNode(
  id: string,
  isOutput: boolean,
  modelId: string | null = 'model_flux',
): GraphNode {
  return {
    id,
    type: 'model',
    position: { x: 0, y: 0 },
    data: {
      ...(modelId === null ? {} : { modelId }),
      ...(isOutput ? { isOutput: true } : {}),
      form: { prompt: 'a knight' },
      inputHandles: [{ id: handleId(id, 'source', 'prompt'), name: 'prompt', type: 'prompt' }],
      outputHandles: [{ id: handleId(id, 'target', 'image'), name: 'output', type: 'image' }],
    },
  }
}

/** `source` is the CONSUMER and `target` the PROVIDER — Scenario's inverted convention. */
const wire = (consumer: string, port: string, provider: string, from: string): GraphEdge => ({
  id: `${provider}--TO--${consumer}`,
  source: consumer,
  sourceHandle: handleId(consumer, 'source', port),
  target: provider,
  targetHandle: handleId(provider, 'target', from),
})

const graphOf = (nodes: readonly GraphNode[], edges: readonly GraphEdge[] = []): GraphState => ({
  nodes,
  edges,
  inputKeys: [],
})

const compile = (graph: GraphState) => {
  const report = vi.fn()
  return { result: compileGraph(graph, { report }), report }
}

/** What the flow is made of, in order — the one assertion a step count cannot stand in for. */
const idsOf = (graph: GraphState): readonly string[] => toEditorFlow(graph).map(step => step.id)

describe('compiling a graph', () => {
  it('turns a text node feeding a generator into a flow', () => {
    const graph = graphOf(
      [textNode('text1', 'a knight'), modelNode('m1', true)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )

    expect(compile(graph).result).toEqual({ ok: true, steps: expect.any(Number) })
  })

  /**
   * The figure is read off the FLOW, never off the canvas — and asserted exactly, because a loose
   * `> 0` is what let a mutation returning the node count survive. A text node becomes a
   * `transform` step of its own here; two nodes, two steps, and that is the converter's decision
   * rather than ours.
   */
  it('counts the steps the flow holds rather than the nodes on the canvas', () => {
    const graph = graphOf(
      [textNode('text1', 'a dragon'), modelNode('m1', true)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )

    expect(idsOf(graph)).toEqual(['text1', 'm1'])
    expect(compile(graph).result).toEqual({ ok: true, steps: 2 })
  })

  /**
   * The generator carries its form into the flow, which is what makes a compiled workflow runnable
   * without the editor beside it.
   *
   * What is NOT asserted here, deliberately: that the wire OVERRIDES that value. It does not —
   * measured, with the node's own handle ids from `factory.ts` — and the reason is a question this
   * lot cannot answer, written up in `docs/todo.md` § 5.1: a text node's output is typed `text`
   * while a model's prompt port is typed `prompt`, so `typesConnect` would refuse the connection
   * on our own canvas. Claiming a resolution here would be claiming a measurement nobody made.
   */
  it('carries the form of a generator into the step it becomes', () => {
    const graph = graphOf([modelNode('m1', true)])
    const generator = toEditorFlow(graph).find(step => step.id === 'm1')

    expect(generator).toMatchObject({ type: 'custom-model', modelId: 'model_flux' })
    expect(generator?.inputs).toContainEqual(
      expect.objectContaining({ name: 'prompt', value: 'a knight' }),
    )
  })

  /**
   * Every type the editor can hold, handed over at once. The converter's union has one arm per
   * type and ours has fifteen: this is what proves the mapping is complete rather than complete
   * for the four the editor draws today — the other eleven arrive with step 8.
   */
  it('hands every node type it can hold to the converter without refusing the graph', () => {
    const others = GRAPH_NODE_TYPES.filter(type => type !== 'model' && type !== 'modelInput').map(
      (type, index): GraphNode => ({
        id: `${type}${index}`,
        type,
        position: { x: 0, y: 0 },
        data: {},
      }),
    )

    const input: GraphNode = {
      id: 'input1',
      type: 'modelInput',
      position: { x: 0, y: 0 },
      data: { inputName: 'prompt' },
    }

    expect(compile(graphOf([...others, input, modelNode('m1', true)])).result.ok).toBe(true)
  })

  /**
   * The one arm with a required field: without a name it is a workflow input nothing can be asked
   * for, and the converter would key the flow's inputs on `undefined`.
   */
  it('drops a workflow input that carries no name', () => {
    const nameless: GraphNode = {
      id: 'input1',
      type: 'modelInput',
      position: { x: 0, y: 0 },
      data: {},
    }

    expect(idsOf(graphOf([nameless, modelNode('m1', true)]))).toEqual(['m1'])
  })

  /** An edge naming neither of its handles is a dependency with no port — still an edge. */
  it('carries an edge that names no handle rather than dropping it', () => {
    const bare: GraphEdge = { id: 'e1', source: 'm1', target: 'text1' }
    const graph = graphOf([textNode('text1', 'a dragon'), modelNode('m1', true)], [bare])

    expect(idsOf(graph)).toEqual(['text1', 'm1'])
  })

  /**
   * A note is drawn on the canvas and belongs to no flow — the converter's own union has no
   * variant for it. Handed over, it would be a node type the SDK cannot read.
   */
  it('walks past a sticky note rather than choking on it', () => {
    const note: GraphNode = {
      id: 'note1',
      type: 'stickyNote',
      position: { x: 0, y: 0 },
      data: { content: 'Read me' },
    }
    const graph = graphOf([note, modelNode('m1', true)])

    // Two nodes, one step — which is also what pins the figure to the FLOW rather than to the
    // canvas: counted off `graph.nodes`, this would answer two.
    expect(idsOf(graph)).toEqual(['m1'])
    expect(compile(graph).result).toEqual({ ok: true, steps: 1 })
  })
})

describe('what a graph is refused for', () => {
  it('refuses one where nothing is marked as an output', () => {
    const graph = graphOf(
      [textNode('text1', 'a knight'), modelNode('m1', false)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )

    expect(compile(graph).result).toEqual({ ok: false, problem: 'no-output' })
  })

  /**
   * The converter reads `isOutput` on three types only — `model`, `llm`, `forEachEnd`. Marked
   * anywhere else it is ignored in silence, and the flow comes back empty with no reason given.
   */
  it('does not take a text node marked as an output for one', () => {
    const marked: GraphNode = {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { value: 'a knight', isOutput: true },
    }

    expect(compile(graphOf([marked])).result).toEqual({ ok: false, problem: 'no-output' })
  })

  it('refuses a generator with no model, and says why in the journal', () => {
    const { result, report } = compile(graphOf([modelNode('m1', true, null)]))

    expect(result).toEqual({ ok: false, problem: 'invalid' })
    // The sentence is the SDK's own English, written for whoever calls it. It belongs in the
    // journal; the screen gets the code beside it.
    expect(report).toHaveBeenCalledWith(expect.stringContaining('modelId'))
  })

  /**
   * A `forEachEnd` is one of the three types the converter takes as an output, and it is the one
   * that ends a loop rather than producing anything: marked alone, every branch it would gather
   * is missing, and the flow comes back empty. "Nothing reaches the output" is a different
   * sentence from "you marked none", and the user acts on it differently.
   */
  it('tells an output nothing reaches apart from an output nobody marked', () => {
    const end: GraphNode = {
      id: 'forEachEnd1',
      type: 'forEachEnd',
      position: { x: 0, y: 0 },
      data: { isOutput: true },
    }

    expect(compile(graphOf([end])).result).toEqual({ ok: false, problem: 'empty' })
  })

  it('says nothing to the journal about a graph that compiles', () => {
    const { report } = compile(graphOf([modelNode('m1', true)]))

    expect(report).not.toHaveBeenCalled()
  })
})
