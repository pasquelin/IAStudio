import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_NODE_TYPES,
  type GraphEdge,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { compileGraph, editorModelOf, modelIdsOf, toEditorFlow } from './workflow-compile'

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

  /**
   * That `compileGraph` hands `getModel` on to the converter, which its own answer cannot show:
   * a verdict reduced to `ok` and a step count is the same either way — measured, both say
   * `{ ok: true, steps: 2 }`. What does show is the lookup itself: handed nothing, the converter
   * never asks, and the wires are dropped in silence. A mutation removing the pass-through
   * survived every other test in this file.
   */
  it('asks for the model of a generator while compiling it, not only while converting', () => {
    const graph = graphOf(
      [textNode('text1', 'a knight'), modelNode('m1', true)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )
    const getModel = vi.fn(() => ({
      id: 'model_flux',
      inputs: [{ name: 'prompt', type: 'string' }],
    }))

    compileGraph(graph, { report: vi.fn(), getModel })

    expect(getModel).toHaveBeenCalledWith('model_flux')
  })

  /**
   * The wire, carried — which is the whole point of resolving the models first.
   *
   * Measured rather than guessed: the converter matches the edge to the input by NAME, then types
   * the flow input from the model's own `type` and replaces the form value with a reference to
   * the node feeding it. `name: 'all'` is the converter's own word for a whole output.
   */
  it('carries a wire into a generator once the model behind it is known', () => {
    const graph = graphOf(
      [textNode('text1', 'a knight'), modelNode('m1', true)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )
    const model = { id: 'model_flux', inputs: [{ name: 'prompt', type: 'string' }] }
    const generator = toEditorFlow(graph, () => model).find(step => step.id === 'm1')

    expect(generator?.inputs).toContainEqual({
      name: 'prompt',
      type: 'string',
      ref: { node: 'text1', name: 'all' },
    })
    // The reference REPLACES the form value: a wired prompt must not also submit what the
    // inspector last held, or the two would race to fill the same field.
    expect(generator?.inputs).not.toContainEqual(
      expect.objectContaining({ name: 'prompt', value: 'a knight' }),
    )
  })

  /**
   * The same graph without the model behind it — still a real path: a model that was deleted, or
   * a key that no longer reaches it, resolves to nothing and the compile goes on without it.
   *
   * Read off the converter: it derives `modelInputs` from `getModel` and skips every wire it
   * cannot name (`if (!modelInput) continue`). What is lost is the wiring; what survives is the
   * form. Pinned so the difference the resolution makes is written down, not assumed.
   */
  it('drops the wire when the model behind it cannot be resolved', () => {
    const graph = graphOf(
      [textNode('text1', 'a knight'), modelNode('m1', true)],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )
    const generator = toEditorFlow(graph).find(step => step.id === 'm1')

    expect(generator?.inputs).toContainEqual(
      expect.objectContaining({ name: 'prompt', value: 'a knight' }),
    )
    // No input of the generator refers to the text node, so nothing wires the two together.
    expect(JSON.stringify(generator?.inputs)).not.toContain('text1')
  })
})

describe('a branch as the converter compiles one', () => {
  /**
   * The one assertion that proves the studio's `conditionBlocks` ARE what Scenario reads: the
   * converter is its own, so a field spelt our way compiles to `'false'`, is filtered out, and
   * leaves a logic item whose cases are `undefined` — a branch that always takes the else, with
   * no error at either end.
   */
  const branch = (id: string, blocks: unknown): GraphNode => ({
    id,
    type: 'ifElse',
    position: { x: 0, y: 0 },
    // Through `JSON.parse` the way a file reaches it, so the test cannot be typed into agreement.
    ...JSON.parse(JSON.stringify({ data: { conditionBlocks: blocks } })),
  })

  const graph = (blocks: unknown): GraphState =>
    graphOf(
      [textNode('text1', 'a knight'), branch('ifElse1', blocks), modelNode('m1', true)],
      [
        wire('ifElse1', 'conditional', 'text1', 'prompt'),
        {
          id: 'm1--case',
          source: 'm1',
          sourceHandle: handleId('m1', 'source', 'prompt'),
          target: 'ifElse1',
          targetHandle: `ifElse1-target-case1`,
        },
      ],
    )

  const logicOf = (blocks: unknown) =>
    toEditorFlow(graph(blocks)).find(step => step.id.startsWith('ifElse1'))

  it('compiles one case per block, numbered from two', () => {
    const step = logicOf([
      { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a knight' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
    ])

    expect(step?.logicType).toBe('if-else')
    expect(step?.logic?.cases?.map(entry => entry.value)).toEqual(['2', '3'])
    expect(step?.logic?.default).toBe('1')
  })

  it('joins the conditions of one block the way the block says', () => {
    const step = logicOf([
      {
        logic: 'or',
        conditions: [
          { field: 'text1', operator: 'contains', value: 'knight' },
          { field: 'text1', operator: 'isEmpty' },
        ],
      },
    ])

    expect(step?.logic?.cases?.[0]?.condition).toContain(' || ')
  })

  /**
   * A field naming a node that feeds nothing is NOT dropped — measured here rather than reasoned,
   * and it went the other way from the guess: `conditionBlockToCEL` falls back to the raw name, so
   * the case compiles against a variable no `inputs` entry declares. Which is the whole argument
   * for the inspector offering a list of wired nodes instead of a field to type into.
   */
  it('compiles a field naming nothing into a variable the flow never declares', () => {
    const step = logicOf([{ logic: 'and', conditions: [{ field: 'nobody', operator: 'equals' }] }])

    expect(step?.logic?.cases?.[0]?.condition).toBe("trim(nobody) == ''")
    expect(JSON.stringify(step?.inputs ?? [])).not.toContain('nobody')
  })

  /** Without a field there is no expression at all: `'false'` is filtered, and the else takes it. */
  it('leaves no case for a block whose condition has no field', () => {
    const step = logicOf([{ logic: 'and', conditions: [{ operator: 'equals', value: 'a' }] }])

    expect(step?.logic?.cases).toBeUndefined()
  })
})

describe('the models a graph names', () => {
  const node = (id: string, type: 'model' | 'llm' | 'text', data: Record<string, unknown>) => ({
    id,
    type,
    position: { x: 0, y: 0 },
    data,
  })

  it('names each model once, however many nodes carry it', () => {
    const graph = graphOf([
      node('m1', 'model', { modelId: 'model_flux' }),
      node('m2', 'model', { modelId: 'model_flux' }),
      node('m3', 'model', { modelId: 'model_sdxl' }),
    ])

    expect(modelIdsOf(graph)).toEqual(['model_flux', 'model_sdxl'])
  })

  /** `llm` holds its model in the same field, under an arm that declares nothing but the basics. */
  it('reads the model of an llm node as well as of a generator', () => {
    const graph = graphOf([node('llm1', 'llm', { modelId: 'model_scenario-llm' })])

    expect(modelIdsOf(graph)).toEqual(['model_scenario-llm'])
  })

  /**
   * A generator carrying no model is what the palette drops before one is chosen, and a file can
   * hold anything at all: neither must become a request for `GET /models/undefined`.
   */
  it('asks for nothing on a node that carries no usable model', () => {
    const graph = graphOf([
      node('m1', 'model', {}),
      node('m2', 'model', { modelId: '' }),
      ...JSON.parse('[{"id":"m3","type":"model","position":{"x":0,"y":0},"data":{"modelId":7}}]'),
      node('text1', 'text', { value: 'a knight' }),
    ])

    expect(modelIdsOf(graph)).toEqual([])
  })
})

describe('a model as the converter reads one', () => {
  it('keeps the API’s own input type, which is what an edge is matched by', () => {
    const model = editorModelOf('model_flux', [
      { name: 'prompt', type: 'string' },
      { name: 'image', type: 'file' },
    ])

    expect(model).toEqual({
      id: 'model_flux',
      inputs: [
        { name: 'prompt', type: 'string' },
        { name: 'image', type: 'file' },
      ],
    })
  })

  /** Bounds travel because the converter coerces static values against them. */
  it('carries the bounds of a number, and spells its allowed values as strings', () => {
    const model = editorModelOf('model_flux', [
      { name: 'steps', type: 'number', min: 1, max: 50, step: 1 },
      { name: 'scheduler', type: 'string', allowedValues: ['euler', 2] },
    ])

    expect(model.inputs).toEqual([
      { name: 'steps', type: 'number', min: 1, max: 50, step: 1 },
      { name: 'scheduler', type: 'string', allowedValues: ['euler', '2'] },
    ])
  })

  it('leaves out what the model does not declare rather than writing undefined', () => {
    const [input] = editorModelOf('model_flux', [{ name: 'prompt', type: 'string' }]).inputs ?? []

    expect(input && Object.keys(input)).toEqual(['name', 'type'])
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
