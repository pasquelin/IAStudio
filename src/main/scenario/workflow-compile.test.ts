import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_NODE_TYPES,
  type GraphConditionBlock,
  type GraphEdge,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { evaluateCel } from '@scenario-labs/sdk/tools/cel'
import { blockToCel } from '@shared/domain/branch'
import {
  compileGraph,
  editorModelOf,
  modelIdsOf,
  refuseFlow,
  toEditorFlow,
} from './workflow-compile'

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

/**
 * The refusal shared with the PUBLICATION, asked on a flow its caller already holds. Reached from
 * `compileGraph` its first two answers can never fire — that path asks them first, to avoid
 * converting a graph nothing reads — so they are asked here, where the publication asks them.
 */
describe('the refusal a compile and a publication share', () => {
  const output = modelNode('m1', true)
  // A real flow rather than one written by hand: the validator refuses an item it does not know,
  // so a hand-made step would prove `invalid` and nothing else.
  const oneStep = toEditorFlow(graphOf([output]))

  it('names the output nobody marked, whatever the flow holds', () => {
    expect(refuseFlow(graphOf([modelNode('m1', false)]), oneStep, vi.fn())).toEqual({
      problem: 'no-output',
      nodes: [],
    })
  })

  it('names an empty flow on a graph that does have an output', () => {
    // The marked output IS the node to look at: it is marked, and nothing reaches it.
    expect(refuseFlow(graphOf([output]), [], vi.fn())).toEqual({
      problem: 'empty',
      nodes: ['m1'],
    })
  })

  it('accepts a flow the validator does not refuse', () => {
    expect(refuseFlow(graphOf([output]), oneStep, vi.fn())).toBeNull()
  })

  /** The validator's own sentence goes to the journal; the screen gets the code. */
  it('journals the validator’s sentence and answers a code', () => {
    const report = vi.fn()

    // No node named: the validator's sentence names one, in English prose nothing here parses.
    expect(refuseFlow(graphOf([output]), [{ id: 'm1', type: 'nonsense' }], report)).toEqual({
      problem: 'invalid',
      nodes: [],
    })
    expect(report).toHaveBeenCalled()
  })
})

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

  /**
   * The studio decides a branch LOCALLY off `blockToCel`, and Scenario decides the published one
   * off the string below. They have to be the same string, or a graph would take one branch in
   * the editor and another once published — the one defect a local run cannot have.
   *
   * `approvals.ts` was transcribed from this same converter and never checked against it. This is
   * that check, for every operator the inspector offers.
   */
  it('writes, for every operator, the CEL the studio decides a branch with', () => {
    const blocks: GraphConditionBlock[] = [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a knight' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'notEquals', value: 'a knight' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'contains', value: 'kni.ght' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'notContains', value: 'kni.ght' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'greaterThan', value: '3' }] },
      {
        logic: 'and',
        conditions: [{ field: 'text1', operator: 'greaterThanOrEqual', value: '3' }],
      },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'lessThan', value: '3' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'lessThanOrEqual', value: '3' }] },
      { logic: 'and', conditions: [{ field: 'text1', operator: 'between', value: ['2', '7'] }] },
    ]

    const scenario = logicOf(blocks)?.logic?.cases?.map(entry => entry.condition)
    // The converter binds a provider to its own input name; locally the same field resolves to
    // the CEL variable that provider's value arrives under. Identity here, so the two strings
    // are comparable at all — what is being measured is the OPERATOR, not the naming.
    const ours = blocks.map(block => blockToCel(block, field => field))

    expect(ours).toEqual(scenario)
  })

  /**
   * The string being right is not the same as the DECISION being right, and that gap is where two
   * defects hid: a condition compiled exactly as Scenario compiles it can still be evaluated over
   * the wrong bindings, or fail to evaluate at all. So this one runs the real evaluator — the same
   * one the studio's thread uses — over what `blockToCel` writes.
   */
  it('decides what Scenario decides, evaluated and not merely spelled', () => {
    const bound = { text1_output: 'a knight', text2_output: 'green' }
    const decide = (block: GraphConditionBlock): unknown =>
      evaluateCel(
        blockToCel(block, field => `${field}_output`),
        bound,
      )

    // Each provider reads as ITSELF: a condition over one must not see what the other carries.
    expect(
      decide({
        logic: 'and',
        conditions: [{ field: 'text1', operator: 'equals', value: 'a knight' }],
      }),
    ).toBe(true)
    expect(
      decide({
        logic: 'and',
        conditions: [{ field: 'text2', operator: 'equals', value: 'a knight' }],
      }),
    ).toBe(false)
    expect(
      decide({
        logic: 'or',
        conditions: [
          { field: 'text2', operator: 'equals', value: 'a knight' },
          { field: 'text1', operator: 'isNotEmpty' },
        ],
      }),
    ).toBe(true)
  })

  /** Joining is the converter's too, and an `or` that joined with `&&` would decide backwards. */
  it('joins a block the way the studio joins it', () => {
    const blocks: GraphConditionBlock[] = [
      {
        logic: 'or',
        conditions: [
          { field: 'text1', operator: 'contains', value: 'knight' },
          { field: 'text1', operator: 'isEmpty' },
        ],
      },
    ]

    expect(blocks.map(block => blockToCel(block, field => field))).toEqual(
      logicOf(blocks)?.logic?.cases?.map(entry => entry.condition),
    )
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

    expect(compile(graph).result).toEqual({ ok: false, problem: 'no-output', nodes: [] })
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

    expect(compile(graphOf([marked])).result).toEqual({
      ok: false,
      problem: 'no-output',
      nodes: [],
    })
  })

  it('refuses a generator with no model, and says why in the journal', () => {
    const { result, report } = compile(graphOf([modelNode('m1', true, null)]))

    expect(result).toEqual({ ok: false, problem: 'invalid', nodes: [] })
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

    expect(compile(graphOf([end])).result).toEqual({
      ok: false,
      problem: 'empty',
      nodes: ['forEachEnd1'],
    })
  })

  it('says nothing to the journal about a graph that compiles', () => {
    const { report } = compile(graphOf([modelNode('m1', true)]))

    expect(report).not.toHaveBeenCalled()
  })
})

/**
 * The two the SDK's validator accepts without a word — and the reason this check is ours.
 *
 * Every case below was measured by running the converter, the refusals and the acceptances alike.
 * The defect is always about a wire LEAVING an end, so an end nothing reads cannot misroute
 * anything: refusing one would refuse a graph that compiles, which two of these tests pin down.
 */
describe('a loop and its end, paired so the converter reads them otherwise', () => {
  const loop = (id: string): GraphNode => ({
    id,
    type: 'forEach',
    position: { x: 0, y: 0 },
    data: {
      inputHandles: [{ id: `${id}-input-0`, name: 'list0', type: 'text' }],
      outputHandles: [{ id: `${id}-output-0`, name: 'item0', type: 'text' }],
    },
  })

  const end = (id: string, parentNodeId?: string): GraphNode => ({
    id,
    type: 'forEachEnd',
    position: { x: 0, y: 0 },
    data: {
      ...(parentNodeId === undefined ? {} : { parentNodeId }),
      isOutput: true,
      inputHandles: [{ id: handleId(id, 'source', 'results'), name: 'results' }],
    },
  })

  /** The item port a loop hands out, which `wire` cannot spell: a loop numbers its ports. */
  const readsItem = (consumer: string, loopId: string): GraphEdge => ({
    id: `${loopId}--TO--${consumer}`,
    source: consumer,
    sourceHandle: handleId(consumer, 'source', 'prompt'),
    target: loopId,
    targetHandle: `${loopId}-output-0`,
  })

  /**
   * The loop, its body and one end that closes it — the shape everything below departs from.
   * `m1` reads the item, `e1` reads `m1`, so `e1` really is downstream of the loop.
   */
  const paired = (): { nodes: GraphNode[]; edges: GraphEdge[] } => ({
    nodes: [loop('L'), modelNode('m1', false), end('e1', 'L')],
    edges: [readsItem('m1', 'L'), wire('e1', 'results', 'm1', 'image')],
  })

  it('accepts a loop whose end reads what it feeds', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, modelNode('reader', true)],
      [...edges, wire('reader', 'prompt', 'e1', 'results')],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /**
   * Measured: whatever reads the stray end reads `{ node: L }` — the loop's own result — while the
   * node really feeding that end is compiled and then read by nobody. `validateWorkflowFlow`
   * answers OK.
   */
  it('refuses an end that is read and names a loop it is not inside of', () => {
    // ONE end, so the other rule cannot speak first: it names the loop and reads a node the loop
    // does not feed, which is what makes it not downstream of it.
    const graph = graphOf(
      [
        loop('L'),
        modelNode('m1', false),
        modelNode('outside', false),
        end('e1', 'L'),
        modelNode('reader', true),
      ],
      [
        readsItem('m1', 'L'),
        wire('e1', 'results', 'outside', 'image'),
        wire('reader', 'prompt', 'e1', 'results'),
      ],
    )

    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-end-outside',
      nodes: ['e1'],
    })
  })

  /**
   * Measured, and the case a comment of this file once waved away as impossible: the converter
   * indexes every node but the inputs, the ends and the workflow inputs, so a wire leaving an end
   * lands on whatever it names — a generator included. The reader then reads a node nothing wired
   * it to, and the validator says OK.
   */
  it('refuses an end that is read and names a node that is no loop at all', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, modelNode('other', true), end('e2', 'other'), modelNode('reader', true)],
      [...edges, wire('e2', 'results', 'm1', 'image'), wire('reader', 'prompt', 'e2', 'results')],
    )

    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-end-outside',
      nodes: ['e2'],
    })
  })

  /**
   * The refusal names the ends AT FAULT, and a spare end nobody reads is not one of them: this
   * file refuses to refuse that graph at all, on the grounds that it misroutes nothing. Blaming
   * it anyway would send the user to delete the one end that is innocent.
   */
  it('leaves an unread end out of the ones it blames', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, end('e2', 'L'), end('e3', 'L'), modelNode('reader2', true)],
      [...edges, wire('reader2', 'prompt', 'e2', 'results')],
    )

    // `e3` names the loop and is read by nobody — so it is not in the list, though `endsNaming`
    // would have put it there.
    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-two-ends',
      nodes: ['e1', 'e2'],
    })
  })

  /**
   * Every misplaced end at once, not the first found: one refusal per debounce would send the user
   * round the same hunt for each of them.
   */
  it('names every end that fails to close what it names, not just the first', () => {
    // Each end names a DIFFERENT node, and neither is a loop — so the two-ends rule above, which
    // speaks first and only over real loops, cannot answer for this graph.
    const { nodes, edges } = paired()
    const graph = graphOf(
      [
        ...nodes,
        modelNode('other', true),
        modelNode('other2', true),
        end('e2', 'other'),
        end('e3', 'other2'),
        modelNode('reader', true),
        modelNode('reader2', true),
      ],
      [
        ...edges,
        wire('e2', 'results', 'm1', 'image'),
        wire('e3', 'results', 'm1', 'image'),
        wire('reader', 'prompt', 'e2', 'results'),
        wire('reader2', 'prompt', 'e3', 'results'),
      ],
    )

    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-end-outside',
      nodes: ['e2', 'e3'],
    })
  })

  /**
   * Measured: the converter keeps the FIRST end and resolves the second's wires to the loop all
   * the same, which pulls whatever read the second INTO the loop's body — a node outside the loop
   * running once per item instead of once.
   */
  it('refuses two ends of one loop when both are read', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, end('e2', 'L'), modelNode('reader', true), modelNode('reader2', true)],
      [
        ...edges,
        wire('reader', 'prompt', 'e1', 'results'),
        wire('e2', 'results', 'm1', 'image'),
        wire('reader2', 'prompt', 'e2', 'results'),
      ],
    )

    // The kept end FIRST, then the spare: which of the two the converter obeys is the whole point.
    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-two-ends',
      nodes: ['e1', 'e2'],
    })
  })

  /**
   * And the acceptance that keeps the rule honest — measured item for item: a second end with no
   * wire leaving it gives a flow IDENTICAL to the graph without it. Refusing this refuses a graph
   * that compiles, on a node the user has not finished wiring.
   */
  it('accepts a second end of the same loop while nothing reads it', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, end('e2', 'L'), modelNode('reader', true)],
      [...edges, wire('reader', 'prompt', 'e1', 'results')],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /**
   * The POSITION of the spare end is what decides, measured both ways on the real converter.
   * Written BEFORE the read one, it is the end the converter retains — the body walk then stops
   * at a node no wire reaches, and everything reading the real end is pulled into the loop's body:
   * a list of ten turns two generations into twenty, and the validator answers OK.
   */
  it('refuses a spare end written before the one that is read', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [
        loop('L'),
        modelNode('m1', false),
        end('e0', 'L'),
        end('e1', 'L'),
        modelNode('reader', true),
      ],
      [...edges, wire('reader', 'prompt', 'e1', 'results')],
    )

    expect(compile(graph).result).toEqual({
      ok: false,
      problem: 'loop-two-ends',
      nodes: ['e0', 'e1'],
    })
    // The same two ends the other way round compile to a flow identical to the graph without the
    // spare one — which is why counting ends refused a graph that compiles.
    expect(
      compile(
        graphOf(
          [...nodes, end('e0', 'L'), modelNode('reader', true)],
          [...edges, wire('reader', 'prompt', 'e1', 'results')],
        ),
      ).result,
    ).toMatchObject({ ok: true })
  })

  /**
   * And the acceptance pinned to the CONVERTER rather than to a memory of having measured it: the
   * flow is compared item for item against the same graph without the second end. The day the SDK
   * starts making something of an end nothing reads, this reddens instead of the rule quietly
   * becoming wrong.
   */
  it('compiles a second end nothing reads to exactly the flow without it', () => {
    const { nodes, edges } = paired()
    const withReader = [...nodes, modelNode('reader', true)]
    const readerEdge = wire('reader', 'prompt', 'e1', 'results')

    const alone = toEditorFlow(graphOf(withReader, [...edges, readerEdge]))
    const spare = toEditorFlow(graphOf([...withReader, end('e2', 'L')], [...edges, readerEdge]))

    expect(spare).toEqual(alone)
  })

  /** Same rule, the other case it saves: an end fed from outside the loop, and read by nobody. */
  it('accepts an end that names a loop it is not inside of while nothing reads it', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, modelNode('outside', false), end('e2', 'L'), modelNode('reader', true)],
      [
        ...edges,
        wire('e2', 'results', 'outside', 'image'),
        wire('reader', 'prompt', 'e1', 'results'),
      ],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /** Two loops, an end each: what makes the check about the PAIR rather than about a count. */
  it('accepts two loops closed by one end each', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [
        ...nodes,
        modelNode('reader', true),
        loop('L2'),
        modelNode('m2', false),
        end('e2', 'L2'),
        modelNode('reader2', true),
      ],
      [
        ...edges,
        wire('reader', 'prompt', 'e1', 'results'),
        readsItem('m2', 'L2'),
        wire('e2', 'results', 'm2', 'image'),
        wire('reader2', 'prompt', 'e2', 'results'),
      ],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /** An end naming nothing claims no pairing, so there is none to be wrong about. */
  it('says nothing about an end that names no loop', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, end('e2'), modelNode('reader', true)],
      [...edges, wire('e2', 'results', 'm1', 'image'), wire('reader', 'prompt', 'e2', 'results')],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /**
   * `parseGraph` validates the node and not its `data`, so a file can put a number under
   * `parentNodeId`. Read as a pairing, it would key the check on `"12"` and refuse a graph nobody
   * mispaired.
   */
  it('says nothing about a parent a file wrote as a number', () => {
    const { nodes, edges } = paired()
    const theirs: GraphNode = {
      id: 'e2',
      type: 'forEachEnd',
      position: { x: 0, y: 0 },
      ...JSON.parse('{"data":{"parentNodeId":12}}'),
    }
    const graph = graphOf(
      [...nodes, theirs, modelNode('reader', true)],
      [...edges, wire('reader', 'prompt', 'e1', 'results')],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })

  /** A loop since deleted: the lookup answers nothing, and the wire is dropped as if never drawn. */
  it('says nothing about an end naming a loop the graph no longer holds', () => {
    const { nodes, edges } = paired()
    const graph = graphOf(
      [...nodes, end('e2', 'gone'), modelNode('reader', true)],
      [...edges, wire('e2', 'results', 'm1', 'image'), wire('reader', 'prompt', 'e2', 'results')],
    )

    expect(compile(graph).result).toMatchObject({ ok: true })
  })
})
