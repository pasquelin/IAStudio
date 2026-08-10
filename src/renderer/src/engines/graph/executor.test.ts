import { describe, expect, it, vi } from 'vitest'
import {
  CONDITIONAL_PORT,
  type GraphNode,
  type GraphNodeRun,
  type GraphState,
} from '@shared/domain/graph'
import { runGraph, type GraphRunPorts, type GraphRunResult } from './executor'
import {
  approvalNode,
  branchNode,
  graphOf,
  guards,
  modelNode,
  noteNode,
  textNode,
  transformNode,
  wire,
} from './graph-fixtures'
import { handleId, outputHandlesOf } from './handles'
import { updateNodeData } from './mutations'
import { planGraph, type GraphCache } from './plan'

type Submitted = { modelId: string; body: Record<string, unknown> }

/**
 * Refuses rather than answering, exactly as the approval port below does: a graph whose transforms
 * a suite never thought about must not sail through one and prove the opposite of what it claims.
 */
const noTransform: GraphRunPorts['transform'] = expression =>
  Promise.reject(new Error(`no transform declared for ${expression}`))

/** A run, and everything it said while it went: what was submitted, and what each node reported. */
type Watched = {
  result: GraphRunResult
  submitted: readonly Submitted[]
  reported: ReadonlyMap<string, readonly GraphNodeRun[]>
  generate: GraphRunPorts['generate']
}

/**
 * Runs a graph against a stub generator, keeping every submission and every state change.
 *
 * `outputs` answers per model id — different ids are how a submission is told from another,
 * since the executor names neither the node nor the port in what it hands over.
 */
async function watch(
  graph: GraphState,
  outputs: Readonly<Record<string, readonly string[]>> = {},
  options: {
    cache?: GraphCache
    signal?: AbortSignal
    /** What the person answers, per approval node. A graph with none never reaches it. */
    approve?: (nodeId: string) => Promise<boolean>
    /** What the evaluator answers. A graph with no transform node never reaches it. */
    transform?: GraphRunPorts['transform']
  } = {},
): Promise<Watched> {
  const submitted: Submitted[] = []
  const reported = new Map<string, GraphNodeRun[]>()

  const generate = vi.fn(async (modelId: string, body: Record<string, unknown>) => {
    submitted.push({ modelId, body })
    const answer = outputs[modelId]
    if (!answer) throw new Error(`no output declared for ${modelId}`)
    return answer
  })

  const result = await runGraph(graph, options.cache, {
    generate,
    // Refuses to answer rather than saying yes: a graph whose approvals a test did not think
    // about would otherwise sail through one, and the test would prove the opposite of that.
    approve:
      options.approve ?? (nodeId => Promise.reject(new Error(`no answer declared for ${nodeId}`))),
    transform: options.transform ?? noTransform,
    report: (nodeId, run) => {
      const held = reported.get(nodeId)
      if (held) held.push(run)
      else reported.set(nodeId, [run])
    },
    ...(options.signal ? { signal: options.signal } : {}),
  })

  return { result, submitted, reported, generate }
}

const statusesOf = (watched: Watched, id: string): readonly string[] =>
  (watched.reported.get(id) ?? []).map(run => run.status)

const failureOf = (watched: Watched, id: string): string | undefined => {
  const last = (watched.reported.get(id) ?? []).at(-1)
  return last?.status === 'failed' ? last.failure : undefined
}

const cacheOf = (result: GraphRunResult): GraphCache => {
  if (!result.ok) throw new Error(`expected a run, got a cycle on ${result.cycle.join(', ')}`)
  return result.cache
}

/** A text node feeding one generator, which feeds another: the chain of the plan's own suite. */
function chain(prompt = 'a knight', last: Readonly<Record<string, unknown>> = {}): GraphState {
  const graph = graphOf(
    [textNode('text1'), modelNode('m1', {}, 'model_a'), modelNode('m2', last, 'model_b')],
    [wire('m1', 'prompt', 'text1', 'prompt'), wire('m2', 'prompt', 'm1', 'image')],
  )

  return updateNodeData(graph, 'text1', { value: prompt })
}

describe('running a graph', () => {
  it('feeds a text node into the port named by the model own field key', async () => {
    const watched = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    expect(watched.submitted[0]).toEqual({ modelId: 'model_a', body: { prompt: 'a knight' } })
  })

  it('hands what a generator produced to the node reading it', async () => {
    const watched = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    expect(watched.submitted[1]).toEqual({ modelId: 'model_b', body: { prompt: 'asset_1' } })
  })

  it('runs a provider before what reads it', async () => {
    const watched = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    expect(watched.submitted.map(call => call.modelId)).toEqual(['model_a', 'model_b'])
  })

  it('says of every node that it ran', async () => {
    const watched = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    expect(statusesOf(watched, 'text1')).toEqual(['done'])
    expect(statusesOf(watched, 'm1')).toEqual(['running', 'done'])
    expect(statusesOf(watched, 'm2')).toEqual(['running', 'done'])
  })

  it('drops the blanks a form carries for the fields nobody filled', async () => {
    // What `modelDataOf` writes into a node nobody opened in the inspector: the model's own
    // defaults, empty string included. Submitted as such, an optional enum answers 400.
    const graph = graphOf([modelNode('m1', { seed: 3, style: '' }, 'model_a')], [])
    const watched = await watch(graph, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({ seed: 3 })
  })

  /** A note is drawn on the canvas and compiles to nothing — a run must walk past it, not trip. */
  it('runs a graph holding a sticky note without asking anything of it', async () => {
    const graph = graphOf(
      [
        { id: 'note1', type: 'stickyNote', position: { x: 0, y: 0 }, data: { content: 'Read me' } },
        modelNode('m1', {}, 'model_a'),
      ],
      [],
    )
    const watched = await watch(graph, { model_a: ['asset_1'] })

    expect(watched.submitted.map(call => call.modelId)).toEqual(['model_a'])
    expect(statusesOf(watched, 'note1')).toEqual([])
  })

  it('submits a generator carrying no form at all, rather than refusing it', async () => {
    const bare: GraphNode = {
      id: 'm1',
      type: 'model',
      position: { x: 0, y: 0 },
      data: { modelId: 'model_a' },
    }
    const watched = await watch(graphOf([bare], []), { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({})
  })

  it('writes nothing for a text node nobody has typed into', async () => {
    const graph = graphOf(
      [textNode('text1'), modelNode('m1', {}, 'model_a')],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )
    const watched = await watch(graph, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({})
  })

  /** The port every node carries to be steered by — never a parameter the model knows. */
  it('keeps a wired conditional port out of the body it submits', async () => {
    const provider: GraphNode = {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        value: 'yes',
        // No `type`, which is what a graph read from Scenario carries and what makes the wire
        // legal in the first place — `typesConnect` refuses nothing when either side is silent.
        outputHandles: [{ id: handleId('text1', 'target', 'output'), name: 'output' }],
      },
    }
    const consumer: GraphNode = {
      id: 'm1',
      type: 'model',
      position: { x: 0, y: 0 },
      data: {
        modelId: 'model_a',
        form: { seed: 3 },
        inputHandles: [{ id: handleId('m1', 'source', 'conditional'), name: 'conditional' }],
      },
    }

    const graph = graphOf([provider, consumer], [wire('m1', 'conditional', 'text1', 'output')])
    const watched = await watch(graph, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({ seed: 3 })
  })

  /** `parseGraph` does not validate `data`, so a form read off a file can hold one. */
  it('drops a null the way the form reader drops it, not only an empty string', async () => {
    const graph = graphOf([modelNode('m1', { seed: 3, style: null }, 'model_a')], [])
    const watched = await watch(graph, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({ seed: 3 })
  })

  it('starts two independent branches at once rather than one after the other', async () => {
    const graph = graphOf([modelNode('m1', {}, 'model_a'), modelNode('m2', {}, 'model_b')], [])

    let running = 0
    let together = 0
    await runGraph(graph, undefined, {
      generate: async () => {
        running += 1
        together = Math.max(together, running)
        await Promise.resolve()
        running -= 1
        return ['asset_1']
      },
      approve: () => Promise.resolve(true),
      transform: noTransform,
      report: () => {},
    })

    expect(together).toBe(2)
  })
})

describe('the values a node hands on', () => {
  it('sends a single id where the form holds one, and a list where it holds a list', async () => {
    const consumer: GraphNode = {
      id: 'm1',
      type: 'model',
      position: { x: 0, y: 0 },
      data: {
        modelId: 'model_a',
        form: { referenceImages: [] },
        inputHandles: [
          { id: handleId('m1', 'source', 'referenceImages'), name: 'referenceImages' },
        ],
      },
    }

    const asset: GraphNode = {
      id: 'asset1',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        value: 'asset_local',
        outputHandles: [{ id: handleId('asset1', 'target', 'image'), name: 'output' }],
      },
    }

    const graph = graphOf([asset, consumer], [wire('m1', 'referenceImages', 'asset1', 'image')])
    const watched = await watch(graph, { model_a: ['asset_out'] })

    expect(watched.submitted[0]?.body).toEqual({ referenceImages: ['asset_local'] })
  })

  it('leaves a port alone when what feeds it produced nothing', async () => {
    const graph = graphOf(
      [textNode('text1'), modelNode('m1', { prompt: 'typed by hand' }, 'model_a')],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )
    const watched = await watch(updateNodeData(graph, 'text1', { value: '' }), {
      model_a: ['asset_1'],
    })

    // A wire carrying nothing does not overwrite: an emptied text node used to write `''` over
    // the prompt, which is a 400 on a required field — and an emptied ASSET node, wired the same
    // way, left the form alone. One rule for both.
    expect(watched.submitted[0]?.body).toEqual({ prompt: 'typed by hand' })
  })

  it('keeps what the form held where its wire carries no asset at all', async () => {
    const asset: GraphNode = {
      id: 'asset1',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        outputHandles: [{ id: handleId('asset1', 'target', 'image'), name: 'output' }],
      },
    }
    const graph = graphOf(
      [asset, modelNode('m1', { prompt: 'a fallback' }, 'model_a')],
      [wire('m1', 'prompt', 'asset1', 'image')],
    )
    const watched = await watch(graph, { model_a: ['asset_out'] })

    // An asset node holding nothing is a wire with nothing on it: writing `undefined` over the
    // form would submit the model with a key it cannot read.
    expect(watched.submitted[0]?.body).toEqual({ prompt: 'a fallback' })
  })

  /**
   * The form decides the arity and nothing else does. A picture input is a single `file` in every
   * schema this studio reads — `schema.ts` only calls a `file` an image, a `file_array` falls back
   * to a raw field and never becomes a port — so a node that produced four and wrote all four
   * would be refused with a 400.
   */
  it('sends the first where a node produced several and the form holds one', async () => {
    const asset: GraphNode = {
      id: 'asset1',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        value: ['asset_one', 'asset_two'],
        outputHandles: [{ id: handleId('asset1', 'target', 'image'), name: 'output' }],
      },
    }
    const graph = graphOf(
      [asset, modelNode('m1', { prompt: '' }, 'model_a')],
      [wire('m1', 'prompt', 'asset1', 'image')],
    )
    const watched = await watch(graph, { model_a: ['asset_out'] })

    expect(watched.submitted[0]?.body).toEqual({ prompt: 'asset_one' })
  })

  /**
   * Two wires onto one port of a GENERATOR, which the editor does not offer to draw and a file may
   * well carry. Both halves of what the converter makes of them: a `file_array` gets the
   * concatenation, and a scalar gets the head of the list — `inputEdges[0]` there, `values[0]`
   * here. Where the plan kept only the last, the studio submitted the wrong asset without a word.
   */
  it('concatenates several wires onto one port, and reads the first for a scalar', async () => {
    const held = (id: string, value: string): GraphNode => ({
      id,
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        value,
        outputHandles: [{ id: handleId(id, 'target', 'image'), name: 'output' }],
      },
    })

    const consumer = (form: Readonly<Record<string, unknown>>): GraphNode => ({
      id: 'm1',
      type: 'model',
      position: { x: 0, y: 0 },
      data: {
        modelId: 'model_a',
        form,
        inputHandles: [
          { id: handleId('m1', 'source', 'referenceImages'), name: 'referenceImages' },
        ],
      },
    })

    const wires = [
      wire('m1', 'referenceImages', 'asset1', 'image'),
      wire('m1', 'referenceImages', 'asset2', 'image'),
    ]
    const nodes = [held('asset1', 'asset_one'), held('asset2', 'asset_two')]

    const asList = await watch(graphOf([...nodes, consumer({ referenceImages: [] })], wires), {
      model_a: ['asset_out'],
    })
    const asOne = await watch(graphOf([...nodes, consumer({ referenceImages: '' })], wires), {
      model_a: ['asset_out'],
    })

    expect(asList.submitted[0]?.body).toEqual({ referenceImages: ['asset_one', 'asset_two'] })
    expect(asOne.submitted[0]?.body).toEqual({ referenceImages: 'asset_one' })
  })

  /**
   * The symptom the edge order is hashed for. A branch hands its `conditional` port on WHOLE, so
   * the two wires feeding it arrive concatenated in edge order and the scalar below takes the head:
   * cutting one of the two and drawing it again — the only way the canvas has to reorder them —
   * changes what is submitted. Hashed without that order, the run came back off the cache with the
   * other wire's picture, and nothing on screen said a stale result had been handed over.
   *
   * On a branch because `takesManyWires` lets only `transformText` and `ifElse` hold several wires
   * on one port, and only a branch passes that list on where a body can read it.
   */
  it('runs a node again when two wires onto one port changed order', async () => {
    const nodes = [
      textNode('text1', 'a knight'),
      textNode('text2', 'a dragon'),
      branchNode('if1', [{ logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] }]),
      modelNode('m1', {}, 'model_a'),
    ]
    const fed = [
      wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
      wire('if1', CONDITIONAL_PORT, 'text2', 'prompt'),
    ]
    const read = wire('m1', 'prompt', 'if1', 'else')
    const answers: GraphRunPorts['transform'] = async () => ['false']

    const first = await watch(
      graphOf(nodes, [...fed, read]),
      { model_a: ['asset_1'] },
      {
        transform: answers,
      },
    )
    const second = await watch(
      graphOf(nodes, [...fed].reverse().concat(read)),
      { model_a: ['asset_2'] },
      { cache: cacheOf(first.result), transform: answers },
    )

    expect(first.submitted[0]?.body).toEqual({ prompt: 'a knight' })
    expect(second.submitted[0]?.body).toEqual({ prompt: 'a dragon' })
  })

  /** An asset node whose asset was cleared holds `''`, which is not an id the API would take. */
  it('reads no asset out of an emptied asset node', async () => {
    const asset: GraphNode = {
      id: 'asset1',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        value: '',
        outputHandles: [{ id: handleId('asset1', 'target', 'image'), name: 'output' }],
      },
    }
    const graph = graphOf(
      [asset, modelNode('m1', {}, 'model_a')],
      [wire('m1', 'prompt', 'asset1', 'image')],
    )
    const watched = await watch(graph, { model_a: ['asset_out'] })

    expect(watched.submitted[0]?.body).toEqual({})
  })
})

describe('reusing what a previous run produced', () => {
  it('reruns only the node whose parameters changed', async () => {
    const first = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    const second = await watch(
      chain('a knight', { quality: 'high' }),
      {
        model_a: ['asset_1'],
        model_b: ['asset_3'],
      },
      { cache: cacheOf(first.result) },
    )

    expect(second.submitted.map(call => call.modelId)).toEqual(['model_b'])
    expect(statusesOf(second, 'm1')).toEqual(['cached'])
  })

  it('hands the cached ids on, so what reads a cached node still runs on them', async () => {
    const first = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    const second = await watch(
      chain('a knight', { quality: 'high' }),
      {
        model_a: ['asset_1'],
        model_b: ['asset_3'],
      },
      { cache: cacheOf(first.result) },
    )

    expect(second.submitted[0]?.body).toEqual({ quality: 'high', prompt: 'asset_1' })
  })

  it('reruns everything downstream of a node whose prompt changed', async () => {
    const first = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })

    const second = await watch(
      chain('a dragon'),
      {
        model_a: ['asset_9'],
        model_b: ['asset_8'],
      },
      { cache: cacheOf(first.result) },
    )

    expect(second.submitted.map(call => call.modelId)).toEqual(['model_a', 'model_b'])
  })

  it('keeps what it reused, so a third run does not lose the second run cache', async () => {
    const first = await watch(chain(), { model_a: ['asset_1'], model_b: ['asset_2'] })
    const second = await watch(
      chain('a knight', { quality: 'high' }),
      {
        model_a: ['asset_1'],
        model_b: ['asset_3'],
      },
      { cache: cacheOf(first.result) },
    )

    const third = await watch(
      chain('a knight', { quality: 'high' }),
      {},
      {
        cache: cacheOf(second.result),
      },
    )

    expect(third.submitted).toEqual([])
    expect(statusesOf(third, 'm1')).toEqual(['cached'])
    expect(statusesOf(third, 'm2')).toEqual(['cached'])
  })
})

describe('what a graph refuses to run', () => {
  it('names the nodes caught in a loop and submits nothing', async () => {
    const graph = graphOf(
      [modelNode('m1', {}, 'model_a'), modelNode('m2', {}, 'model_b')],
      [wire('m1', 'prompt', 'm2', 'image'), wire('m2', 'prompt', 'm1', 'image')],
    )
    const watched = await watch(graph, { model_a: ['asset_1'], model_b: ['asset_2'] })

    expect(watched.result).toEqual({ ok: false, cycle: ['m1', 'm2'] })
    expect(watched.submitted).toEqual([])
    expect(failureOf(watched, 'm1')).toBe('cycle')
  })

  it('refuses a generator with no model rather than submitting an empty id', async () => {
    const graph = graphOf([modelNode('m1', {}, null)], [])
    const watched = await watch(graph)

    expect(watched.generate).not.toHaveBeenCalled()
    expect(failureOf(watched, 'm1')).toBe('no-model')
  })

  it('says of a type it cannot run yet that it cannot, rather than running it wrong', async () => {
    const graph = graphOf(
      [{ id: 'loop1', type: 'forEach', position: { x: 0, y: 0 }, data: {} }],
      [],
    )
    const watched = await watch(graph)

    expect(failureOf(watched, 'loop1')).toBe('unsupported')
  })

  it('never asks a node whose provider failed, and says why it stayed put', async () => {
    const watched = await watch(chain(), { model_b: ['asset_2'] })

    expect(failureOf(watched, 'm1')).toBe('rejected')
    expect(failureOf(watched, 'm2')).toBe('blocked')
    expect(watched.submitted.map(call => call.modelId)).toEqual(['model_a'])
  })

  it('keeps a failed node out of the cache, so the next run tries it again', async () => {
    const first = await watch(chain(), { model_b: ['asset_2'] })
    const second = await watch(
      chain(),
      { model_a: ['asset_1'], model_b: ['asset_2'] },
      {
        cache: cacheOf(first.result),
      },
    )

    expect(second.submitted.map(call => call.modelId)).toEqual(['model_a', 'model_b'])
  })
})

describe('stopping a run', () => {
  it('leaves the nodes it had not started idle rather than failed', async () => {
    const controller = new AbortController()
    const graph = chain()

    const reported = new Map<string, GraphNodeRun[]>()
    await runGraph(graph, undefined, {
      generate: async () => {
        controller.abort()
        return ['asset_1']
      },
      approve: () => Promise.resolve(true),
      transform: noTransform,
      report: (nodeId, run) => {
        const held = reported.get(nodeId)
        if (held) held.push(run)
        else reported.set(nodeId, [run])
      },
      signal: controller.signal,
    })

    expect(reported.get('m2')?.map(run => run.status)).toEqual(['idle'])
    // And no node ANYWHERE is red, which is the whole of what `stalled` promises: the node that
    // was on the wire when the stop landed has nothing to hand on, and blaming it for a run the
    // user ended would be the one report this must never file. Asserted over every node because
    // the mistake is a reader's, and a reader is whichever one comes next.
    expect([...reported.values()].flat().map(run => run.status)).not.toContain('failed')
  })

  /**
   * The other half of that same guard, and the half no test held: a generation that came back
   * AFTER the stop must not land in the cache. Filed there, the next Run would paint the node
   * `cached` off a run the user ended and never regenerate it — the result is real, but nobody
   * asked for the run that produced it.
   */
  it('keeps out of the cache what came back after the stop', async () => {
    const controller = new AbortController()

    const run = await runGraph(chain(), undefined, {
      generate: async () => {
        controller.abort()
        return ['asset_1']
      },
      approve: () => Promise.resolve(false),
      transform: noTransform,
      report: () => {},
      signal: controller.signal,
    })

    // What the text node produced BEFORE the stop belongs there; what came back after does not.
    expect(run.ok && [...run.cache.values()].flat()).not.toContain('asset_1')
  })

  it('submits nothing at all when the stop came before the run', async () => {
    const controller = new AbortController()
    controller.abort()

    const watched = await watch(chain(), {}, { signal: controller.signal })

    expect(watched.generate).not.toHaveBeenCalled()
  })

  /**
   * A stop cancels the job on the wire, so the generation throws right after — painting the node
   * red would blame the API for what the user had just asked for.
   */
  it('does not report a failure for the job its own stop cancelled', async () => {
    const controller = new AbortController()

    const reported = new Map<string, GraphNodeRun[]>()
    await runGraph(chain(), undefined, {
      generate: async () => {
        controller.abort()
        throw new Error('cancelled')
      },
      approve: () => Promise.resolve(true),
      transform: noTransform,
      report: (nodeId, run) => {
        const held = reported.get(nodeId)
        if (held) held.push(run)
        else reported.set(nodeId, [run])
      },
      signal: controller.signal,
    })

    expect(reported.get('m1')?.map(run => run.status)).toEqual(['running', 'idle'])
  })
})

/**
 * The gate: `m1` produces, `approval1` guards it, and `m2` reads `m1`. The run stops between the
 * two generators — which is where a published workflow would stop, since the converter makes
 * everything reading a guarded node depend on its approval.
 */
describe('stopping on an approval', () => {
  const gated = (message = ''): GraphState =>
    graphOf(
      [
        modelNode('m1', {}, 'model_a'),
        modelNode('m2', {}, 'model_b'),
        approvalNode('approval1', message),
      ],
      [wire('m2', 'prompt', 'm1', 'image'), guards('approval1', 'm1')],
    )

  const outputs = { model_a: ['asset_1'], model_b: ['asset_2'] }

  it('asks between the node it guards and whatever reads it', async () => {
    // One log for the two ports rather than two counters: the ORDER is the whole claim, and two
    // lists compared after the fact cannot say which came first.
    const events: string[] = []

    await runGraph(gated(), undefined, {
      generate: async modelId => {
        events.push(`generate:${modelId}`)
        return [`asset_${modelId}`]
      },
      approve: async nodeId => {
        events.push(`approve:${nodeId}`)
        return true
      },
      transform: noTransform,
      report: () => {},
    })

    expect(events).toEqual(['generate:model_a', 'approve:approval1', 'generate:model_b'])
  })

  it('says it is waiting, then done, when the answer is yes', async () => {
    const watched = await watch(gated(), outputs, { approve: () => Promise.resolve(true) })

    expect(statusesOf(watched, 'approval1')).toEqual(['awaiting', 'done'])
    expect(statusesOf(watched, 'm2')).toEqual(['running', 'done'])
  })

  it('holds back everything reading the guarded node when the answer is no', async () => {
    const watched = await watch(gated(), outputs, { approve: () => Promise.resolve(false) })

    expect(failureOf(watched, 'approval1')).toBe('declined')
    expect(failureOf(watched, 'm2')).toBe('blocked')
    // The guarded node itself already ran: an approval is asked ABOUT something, so it is asked
    // once that something exists.
    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_a'])
  })

  it('never files an approval in the cache', async () => {
    const watched = await watch(gated(), outputs, { approve: () => Promise.resolve(true) })
    const plan = planGraph(gated())
    const approval = plan.ok ? plan.order.find(node => node.id === 'approval1') : undefined

    expect(approval).toBeDefined()
    expect(cacheOf(watched.result).has(approval?.hash ?? '')).toBe(false)
  })

  /**
   * The point of the gate being in the plan rather than in the executor: a result approved on one
   * run must not come back on the next through the cache, without the question being put again.
   */
  it('asks again on a second run, even where every node is cached', async () => {
    const first = await watch(gated(), outputs, { approve: () => Promise.resolve(true) })

    const asked: string[] = []
    const second = await watch(gated(), outputs, {
      cache: cacheOf(first.result),
      approve: async nodeId => {
        asked.push(nodeId)
        return false
      },
    })

    expect(asked).toEqual(['approval1'])
    expect(statusesOf(second, 'm1')).toEqual(['cached'])
    // Declined this time, so what reads the guarded node is held back — cache or no cache.
    expect(failureOf(second, 'm2')).toBe('blocked')
    expect(statusesOf(second, 'm2')).not.toContain('cached')
  })

  it('treats a question that cannot be answered as a no', async () => {
    const watched = await watch(gated(), outputs, {
      approve: () => Promise.reject(new Error('the window went away')),
    })

    expect(failureOf(watched, 'approval1')).toBe('declined')
  })

  it('leaves an approval idle rather than declined when the run was stopped', async () => {
    const controller = new AbortController()
    const watched = await watch(gated(), outputs, {
      signal: controller.signal,
      approve: async () => {
        controller.abort()
        return false
      },
    })

    expect(statusesOf(watched, 'approval1')).toEqual(['awaiting', 'idle'])
    // And nothing downstream of the gate runs. An approval that made it through hands back the
    // same empty outcome as one nobody asked — so a stop that let this one answer `produced` would
    // open the gate on a run the user just ended, and the next generation would be paid for.
    expect(watched.submitted.map(call => call.modelId)).not.toContain('model_b')
  })

  /**
   * An approval guarding nothing compiles to no flow item at all — the converter drops it before
   * it ever reaches the flow. Asked anyway, the studio would stop a run on a question the App it
   * exports would never put, and the user would answer for nothing.
   */
  it('asks nothing of an approval left unwired', async () => {
    const loose = graphOf([modelNode('m1', {}, 'model_a'), approvalNode('approval1')], [])
    const asked: string[] = []
    const watched = await watch(loose, outputs, {
      approve: async nodeId => {
        asked.push(nodeId)
        return true
      },
    })

    expect(asked).toEqual([])
    expect(statusesOf(watched, 'approval1')).toEqual([])
    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_a'])
  })

  /**
   * Two approvals on one node: the converter keeps the LAST and gives the other no flow item, so
   * one question is asked once. Asking both would queue them, and declining the winner painted
   * the loser "upstream failed" — for a node nothing had failed on and nobody had asked.
   */
  describe('two approvals guarding one node', () => {
    const rivals = (): GraphState =>
      graphOf(
        [modelNode('m1', {}, 'model_a'), approvalNode('approval1'), approvalNode('approval2')],
        [guards('approval1', 'm1'), guards('approval2', 'm1')],
      )

    it('asks only the one the converter would keep', async () => {
      const asked: string[] = []
      await watch(rivals(), outputs, {
        approve: async nodeId => {
          asked.push(nodeId)
          return true
        },
      })

      expect(asked).toEqual(['approval2'])
    })

    it('says nothing at all of the one it does not ask', async () => {
      const watched = await watch(rivals(), outputs, { approve: () => Promise.resolve(false) })

      expect(failureOf(watched, 'approval2')).toBe('declined')
      expect(statusesOf(watched, 'approval1')).toEqual([])
    })
  })

  it('never asks about a node that failed to produce', async () => {
    const asked: string[] = []
    await watch(
      gated(),
      { model_b: ['asset_2'] },
      {
        approve: async nodeId => {
          asked.push(nodeId)
          return true
        },
      },
    )

    expect(asked).toEqual([])
  })
})

describe('a transform node', () => {
  /**
   * A text node feeding a transform, which feeds a generator's prompt: the whole reason the type
   * exists — a prompt built out of what an earlier node produced.
   */
  const rewriting = (expression: string): GraphState =>
    graphOf(
      [textNode('text1'), transformNode('transformText1', expression), modelNode('m1')],
      [
        wire('transformText1', 'text', 'text1', 'prompt'),
        wire('m1', 'prompt', 'transformText1', 'text'),
      ],
    )

  /**
   * The name the SDK's converter gives the wire — `<providerId>_<outputName>`, read off
   * `workflow_converter.ts`. Named any other way here, an expression that runs locally would read
   * an unknown variable the day the App is published.
   */
  it('hands the evaluator its variables under the names the converter gives the wires', async () => {
    const transform = vi.fn(() => Promise.resolve(['rewritten']))

    await watch(
      rewriting("'A photo of ' + text1_output"),
      { model_flux: ['asset_1'] },
      {
        transform,
      },
    )

    expect(transform).toHaveBeenCalledWith("'A photo of ' + text1_output", {
      text1_output: '',
    })
  })

  it('hands over what the node feeding it actually produced', async () => {
    const transform = vi.fn(() => Promise.resolve(['rewritten']))
    const graph = updateNodeData(rewriting('text1_output'), 'text1', { value: 'a cat' })

    await watch(graph, { model_flux: ['asset_1'] }, { transform })

    expect(transform).toHaveBeenCalledWith('text1_output', { text1_output: 'a cat' })
  })

  it('passes what it produced to whatever reads it', async () => {
    const watched = await watch(
      updateNodeData(rewriting('text1_output'), 'text1', { value: 'a cat' }),
      { model_flux: ['asset_1'] },
      { transform: () => Promise.resolve(['a photo of a cat']) },
    )

    expect(watched.submitted).toEqual([
      { modelId: 'model_flux', body: { prompt: 'a photo of a cat' } },
    ])
  })

  it('reports it is running, then done', async () => {
    const watched = await watch(
      rewriting('text1_output'),
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.resolve(['rewritten']),
      },
    )

    expect(statusesOf(watched, 'transformText1')).toEqual(['running', 'done'])
  })

  /** The state every transform starts in, and what the converter compiles it to: `''`. */
  it('produces nothing for an empty expression, without asking the evaluator', async () => {
    const transform = vi.fn(() => Promise.resolve(['never']))

    const watched = await watch(rewriting(''), { model_flux: ['asset_1'] }, { transform })

    expect(transform).not.toHaveBeenCalled()
    expect(statusesOf(watched, 'transformText1')).toEqual(['done'])
  })

  /** Nothing produced must not overwrite what the form of the node reading it holds. */
  it('leaves the prompt of what reads it alone when it produced nothing', async () => {
    const watched = await watch(rewriting(''), { model_flux: ['asset_1'] })

    expect(watched.submitted).toEqual([{ modelId: 'model_flux', body: {} }])
  })

  it('fails on the node itself when the expression would not evaluate', async () => {
    const watched = await watch(
      rewriting('nope('),
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.resolve(null),
      },
    )

    expect(failureOf(watched, 'transformText1')).toBe('invalid-expression')
  })

  /** A refusal is the node's, not the graph's: what reads it says why it never ran. */
  it('blocks what reads it rather than submitting a prompt it never got', async () => {
    const watched = await watch(
      rewriting('nope('),
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.resolve(null),
      },
    )

    expect(failureOf(watched, 'm1')).toBe('blocked')
    expect(watched.generate).not.toHaveBeenCalled()
  })

  /**
   * The evaluator lives across the IPC boundary, so its promise can reject for reasons that are
   * not the expression — a bridge that went away mid-run. The node says the same thing either
   * way rather than taking the whole run down with an unhandled rejection.
   */
  it('fails on the node when the evaluator rejects rather than answering', async () => {
    const watched = await watch(
      rewriting('text1_output'),
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.reject(new Error('no bridge')),
      },
    )

    expect(failureOf(watched, 'transformText1')).toBe('invalid-expression')
  })

  it('reuses what an earlier run produced rather than evaluating again', async () => {
    const graph = rewriting('text1_output')
    const first = await watch(
      graph,
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.resolve(['rewritten']),
      },
    )

    const transform = vi.fn(() => Promise.resolve(['rewritten']))
    const second = await watch(
      graph,
      { model_flux: ['asset_1'] },
      {
        cache: cacheOf(first.result),
        transform,
      },
    )

    expect(transform).not.toHaveBeenCalled()
    expect(statusesOf(second, 'transformText1')).toEqual(['cached'])
  })

  it('evaluates again once its expression changed', async () => {
    const graph = rewriting('text1_output')
    const first = await watch(
      graph,
      { model_flux: ['asset_1'] },
      {
        transform: () => Promise.resolve(['rewritten']),
      },
    )

    const transform = vi.fn(() => Promise.resolve(['other']))
    await watch(
      updateNodeData(graph, 'transformText1', { value: "'x' + text1_output" }),
      {
        model_flux: ['asset_1'],
      },
      { cache: cacheOf(first.result), transform },
    )

    expect(transform).toHaveBeenCalledOnce()
  })

  /**
   * The port every node carries to be steered by, kept out of the variables for the reason it is
   * kept out of a body: it decides whether the node runs at all, and the converter skips that edge
   * before it names anything. Left in, an expression would see a variable no published run has.
   */
  it('keeps a wired conditional port out of the variables it hands over', async () => {
    const transform = vi.fn(() => Promise.resolve(['rewritten']))
    const graph = graphOf(
      [textNode('text1'), textNode('text2'), transformNode('transformText1', 'text1_output')],
      [
        wire('transformText1', 'text', 'text1', 'prompt'),
        wire('transformText1', 'conditional', 'text2', 'prompt'),
      ],
    )

    await watch(updateNodeData(graph, 'text1', { value: 'a cat' }), {}, { transform })

    expect(transform).toHaveBeenCalledWith('text1_output', { text1_output: 'a cat' })
  })

  /**
   * The sentence this lot exists for. Two text nodes onto ONE port of a transform: the converter
   * names one variable per wire, so both must reach the evaluator — where only the last of them
   * used to, the plan having keyed its inputs by port name.
   */
  it('hands over one variable per wire where several land on one port', async () => {
    const transform = vi.fn(() => Promise.resolve(['a cat in a hat']))
    const graph = graphOf(
      [
        textNode('text1'),
        textNode('text2'),
        transformNode('transformText1', 'text1_output + text2_output'),
      ],
      [
        wire('transformText1', 'text', 'text1', 'prompt'),
        wire('transformText1', 'text', 'text2', 'prompt'),
      ],
    )
    const filled = updateNodeData(updateNodeData(graph, 'text1', { value: 'a cat' }), 'text2', {
      value: ' in a hat',
    })

    await watch(filled, {}, { transform })

    expect(transform).toHaveBeenCalledWith('text1_output + text2_output', {
      text1_output: 'a cat',
      text2_output: ' in a hat',
    })
  })

  /** A generator asked for four pictures produced four: the variable is the list, not the first. */
  it('hands over a list where the node feeding it produced several', async () => {
    const transform = vi.fn(() => Promise.resolve(['rewritten']))
    const graph = graphOf(
      [modelNode('m1', {}, 'model_a'), transformNode('transformText1', 'm1_output[0]')],
      [wire('transformText1', 'text', 'm1', 'image')],
    )

    await watch(graph, { model_a: ['asset_1', 'asset_2'] }, { transform })

    expect(transform).toHaveBeenCalledWith('m1_output[0]', {
      m1_output: ['asset_1', 'asset_2'],
    })
  })

  /**
   * `?? 'output'` in the converter, copied here: a graph read off a file can carry an output
   * handle with no name at all, and both sides must then call the variable the same thing.
   */
  it('falls back to the output name the converter falls back to', async () => {
    const transform = vi.fn(() => Promise.resolve(['rewritten']))
    const unnamed: GraphNode = {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        value: 'a cat',
        outputHandles: [{ id: handleId('text1', 'target', 'prompt') }],
      },
    }
    const graph = graphOf(
      [unnamed, transformNode('transformText1', 'text1_output')],
      [wire('transformText1', 'text', 'text1', 'prompt')],
    )

    await watch(graph, {}, { transform })

    expect(transform).toHaveBeenCalledWith('text1_output', { text1_output: 'a cat' })
  })

  /**
   * Filing a result a stopped run produced would make the next Run reuse it, exactly as it would
   * for a generation the user stopped paying for.
   */
  it('keeps nothing a stopped run evaluated', async () => {
    const controller = new AbortController()

    const watched = await watch(
      rewriting('text1_output'),
      { model_flux: ['asset_1'] },
      {
        signal: controller.signal,
        transform: () => {
          controller.abort()
          return Promise.resolve(['rewritten'])
        },
      },
    )

    expect(statusesOf(watched, 'transformText1')).toEqual(['running', 'idle'])
    expect(cacheOf(watched.result).size).toBe(1)
  })
})

describe('a branch, run locally', () => {
  /** Two branches and the else, fed by one text node the conditions test. */
  const graph = (value: string): GraphState =>
    graphOf(
      [
        textNode('text1', value),
        branchNode('if1', [
          { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a knight' }] },
          { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
        ]),
        modelNode('m1', {}, 'model_case1'),
        modelNode('m2', {}, 'model_else'),
      ],
      [
        wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
        wire('m1', 'prompt', 'if1', 'case1'),
        wire('m2', 'prompt', 'if1', 'else'),
      ],
    )

  /** The evaluator, standing in for the thread: it answers what CEL would, not what a test wants. */
  const decides =
    (answers: Readonly<Record<string, boolean>>): GraphRunPorts['transform'] =>
    async expression => [String(answers[expression] ?? false)]

  it('sends what it received down the branch whose condition holds', async () => {
    const watched = await watch(
      graph('a knight'),
      { model_case1: ['asset_1'] },
      {
        transform: decides({ "trim(text1_output) == 'a knight'": true }),
      },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case1'])
    expect(watched.submitted[0]?.body).toEqual({ prompt: 'a knight' })
    expect(statusesOf(watched, 'if1')).toContain('done')
  })

  /**
   * The reader of a branch that was not taken must see NOTHING — not what the branch that was
   * taken produced. That is the whole reason an outcome is by port rather than a flat list.
   *
   * And it must not be painted as a FAILURE either: `blocked` says something it reads went wrong,
   * in the red that goes with it. Nothing went wrong here — a condition chose elsewhere, which is
   * a branch doing its job.
   */
  it('leaves the readers of every other branch skipped, never failed', async () => {
    const watched = await watch(
      graph('a knight'),
      { model_case1: ['asset_1'] },
      {
        transform: decides({ "trim(text1_output) == 'a knight'": true }),
      },
    )

    expect(watched.submitted.map(one => one.modelId)).not.toContain('model_else')
    expect(statusesOf(watched, 'm2')).toEqual(['skipped'])
    expect(failureOf(watched, 'm2')).toBeUndefined()
  })

  /** The skip travels: a node reading a skipped one was not reached either, and says so. */
  it('carries the skip on to whatever reads the branch that was not taken', async () => {
    const chained = graph('a knight')
    const watched = await watch(
      {
        ...chained,
        nodes: [...chained.nodes, modelNode('m3', {}, 'model_after')],
        edges: [...chained.edges, wire('m3', 'prompt', 'm2', 'image')],
      },
      { model_case1: ['asset_1'] },
      {
        transform: decides({ "trim(text1_output) == 'a knight'": true }),
      },
    )

    expect(statusesOf(watched, 'm3')).toEqual(['skipped'])
    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case1'])
  })

  /**
   * A branch's PORT ORDER is its routing table — block `n` goes to port `n` — and it is out of the
   * hash, deliberately: `outputHandles` says nothing about what any other node computes. So a file
   * that swaps two ports without touching a block leaves every hash downstream identical, and the
   * reader of the branch that is no longer taken would come back green off the cache.
   *
   * The skip has to be seen before the cache is read, which is why the cache is read after the
   * inputs — the same rule the approvals already had.
   */
  it('skips a cached reader whose branch a reordered port no longer feeds', async () => {
    const routed = graph('a knight')
    const answers = decides({ "trim(text1_output) == 'a knight'": true })
    const first = await watch(routed, { model_case1: ['asset_1'] }, { transform: answers })

    // Read off the graph under test rather than rebuilt from `branchNode`: a reconstruction would
    // go on swapping ports the suite no longer declares.
    const ports = routed.nodes.filter(node => node.id === 'if1').flatMap(outputHandlesOf)
    const swapped = updateNodeData(routed, 'if1', { outputHandles: ports.reverse() })

    const kept = cacheOf(first.result)
    const second = await watch(
      swapped,
      { model_else: ['asset_2'] },
      { cache: kept, transform: answers },
    )

    // The premise, asserted rather than assumed: `m1` IS still a cache hit under the swapped
    // ports. Without this, hashing the port order one day would empty the test in silence — `m1`
    // would go skipped for the plain reason that nothing was held for it.
    const planned = planGraph(swapped, kept)
    expect(planned.ok && planned.order.find(node => node.id === 'm1')?.cached).toBe(true)

    expect(statusesOf(second, 'm1')).toEqual(['skipped'])
    expect(second.submitted.map(one => one.modelId)).toEqual(['model_else'])
  })

  /**
   * The other half of reading the cache after the inputs: the stop is asked before it too. A run
   * somebody stopped must not go on painting nodes green off an earlier one — the grey of `idle`
   * is what a run that was interrupted looks like.
   */
  it('leaves a cached reader idle when the run was stopped, rather than painting it cached', async () => {
    const routed = graph('a knight')
    const first = await watch(
      routed,
      { model_case1: ['asset_1'] },
      { transform: decides({ "trim(text1_output) == 'a knight'": true }) },
    )

    const controller = new AbortController()
    const second = await watch(
      routed,
      { model_case1: ['asset_1'] },
      {
        cache: cacheOf(first.result),
        signal: controller.signal,
        transform: async () => {
          controller.abort()
          return ['true']
        },
      },
    )

    expect(statusesOf(second, 'm1')).toEqual(['idle'])
    expect(second.submitted).toEqual([])
  })

  /**
   * A branch that could not decide at all is not a branch that chose this reader: handing back what
   * a previous run left in the cache would assert a route nobody took this time.
   */
  it('blocks a cached reader whose branch failed to decide', async () => {
    const routed = graph('a knight')
    const first = await watch(
      routed,
      { model_case1: ['asset_1'] },
      { transform: decides({ "trim(text1_output) == 'a knight'": true }) },
    )

    const second = await watch(
      routed,
      { model_case1: ['asset_1'] },
      { cache: cacheOf(first.result), transform: async () => null },
    )

    expect(failureOf(second, 'if1')).toBe('invalid-expression')
    expect(failureOf(second, 'm1')).toBe('blocked')
    expect(statusesOf(second, 'm1')).not.toContain('cached')
  })

  it('takes the else when no condition holds', async () => {
    const watched = await watch(
      graph('a dragon'),
      { model_else: ['asset_2'] },
      {
        transform: decides({}),
      },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_else'])
  })

  it('takes the first branch that holds, never a later one', async () => {
    const watched = await watch(
      graph('a knight'),
      { model_case1: ['asset_1'] },
      {
        transform: decides({
          "trim(text1_output) == 'a knight'": true,
          'text1_output != null && size(text1_output) > 0 && (type(text1_output) == list || trim(text1_output) != "")': true,
        }),
      },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case1'])
  })

  /**
   * A branch left empty in the inspector compiles to no case at all — Scenario's converter drops
   * it. It must therefore be UNTAKEABLE, not always true: a new branch, added and not yet filled
   * in, would otherwise swallow everything the branches under it were meant to catch.
   */
  it('walks past a branch with nothing readable to test', async () => {
    const empty = graphOf(
      [
        textNode('text1', 'a knight'),
        branchNode('if1', [
          { logic: 'and', conditions: [{ operator: 'equals', value: 'a knight' }] },
          { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
        ]),
        modelNode('m1', {}, 'model_case1'),
        modelNode('m2', {}, 'model_case2'),
      ],
      [
        wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
        wire('m1', 'prompt', 'if1', 'case1'),
        wire('m2', 'prompt', 'if1', 'case2'),
      ],
    )

    const watched = await watch(
      empty,
      { model_case2: ['asset_2'] },
      {
        transform: decides({
          'text1_output != null && size(text1_output) > 0 && (type(text1_output) == list || trim(text1_output) != "")': true,
        }),
      },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case2'])
  })

  /**
   * An approval standing on a branch nobody took was never PUT to anyone, so what it guards was
   * not refused — it was not reached. Reporting `blocked` there would paint red a node whose
   * question was never asked.
   */
  it('does not read an approval on a branch nobody took as a refusal', async () => {
    const gated = graphOf(
      [
        textNode('text1', 'a dragon'),
        branchNode('if1', [
          { logic: 'and', conditions: [{ field: 'text1', operator: 'equals', value: 'a knight' }] },
        ]),
        modelNode('m1', {}, 'model_case1'),
        approvalNode('a1'),
        modelNode('m2', {}, 'model_after'),
      ],
      [
        wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
        wire('m1', 'prompt', 'if1', 'case1'),
        guards('a1', 'm1'),
        wire('m2', 'prompt', 'm1', 'image'),
      ],
    )

    const watched = await watch(gated, {}, { transform: decides({}) })

    expect(statusesOf(watched, 'a1')).toEqual(['skipped'])
    expect(statusesOf(watched, 'm2')).toEqual(['skipped'])
    expect(failureOf(watched, 'm2')).toBeUndefined()
  })

  /**
   * Two providers in one condition, and each has to read as ITSELF.
   *
   * The port carries the two lists concatenated — that is what fills a body. The CEL variables do
   * not: the converter writes one reference per edge, to that edge's own provider. Handing both
   * names the concatenation would decide a two-field condition differently from the published
   * workflow, which is the one thing a local run must never do.
   */
  it('gives each provider of a condition its own value, never the port total', async () => {
    const two = graphOf(
      [
        textNode('text1', 'a knight'),
        textNode('text2', 'a dragon'),
        branchNode('if1', [
          { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
        ]),
        modelNode('m1', {}, 'model_case1'),
      ],
      [
        wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
        wire('if1', CONDITIONAL_PORT, 'text2', 'prompt'),
        wire('m1', 'prompt', 'if1', 'case1'),
      ],
    )

    const seen: Record<string, string | readonly string[]>[] = []
    await watch(
      two,
      { model_case1: ['asset_1'] },
      {
        transform: async (_expression, variables) => {
          seen.push({ ...variables })
          return ['true']
        },
      },
    )

    expect(seen[0]?.text1_output).toBe('a knight')
    expect(seen[0]?.text2_output).toBe('a dragon')
  })

  /**
   * A file may carry more ports than blocks, and `grownTo` says in as many words that trimming
   * them would be this editor deciding what a document it did not write meant. The converter
   * reads EVERY port past the last block as the default; so must the studio.
   */
  it('serves every else port a file carries, not only the first', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] },
    ])
    const many = updateNodeData(
      graphOf(
        [
          textNode('text1', 'a knight'),
          branch,
          modelNode('m1', {}, 'model_else'),
          modelNode('m2', {}, 'model_else2'),
        ],
        [
          wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'),
          wire('m1', 'prompt', 'if1', 'else'),
          wire('m2', 'prompt', 'if1', 'else2'),
        ],
      ),
      'if1',
      {
        outputHandles: [
          ...outputHandlesOf(branch),
          { id: 'if1-target-else2', name: 'else2', type: 'text' },
        ],
      },
    )

    const watched = await watch(
      many,
      { model_else: ['a'], model_else2: ['b'] },
      { transform: decides({}) },
    )

    expect(watched.submitted.map(one => one.modelId).sort()).toEqual(['model_else', 'model_else2'])
  })

  /** A branch with nowhere to send what none of its conditions matched cannot be run. */
  it('fails a branch that carries no else port at all', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] },
    ])
    const noElse = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), branch],
        [wire('if1', CONDITIONAL_PORT, 'text1', 'prompt')],
      ),
      'if1',
      { outputHandles: [] },
    )

    expect(failureOf(await watch(noElse, {}, { transform: decides({}) }), 'if1')).toBe('unwired')
  })

  /**
   * A provider that publishes on NO port at all — a note, which compiles to nothing — is a
   * malformed wire, not a branch nobody took: red, not the quiet grey of `skipped`. The
   * distinction is the whole reason the absent-port answer looks at what the provider did produce.
   */
  it('blocks a reader wired to something that publishes on no port at all', async () => {
    const strayed = graphOf(
      [noteNode('note1'), modelNode('m1', {}, 'model_a')],
      [wire('m1', 'prompt', 'note1', 'output')],
    )

    const watched = await watch(strayed, { model_a: ['asset_1'] })

    expect(failureOf(watched, 'm1')).toBe('blocked')
    expect(watched.submitted).toEqual([])
  })

  /** A thread that dies is not the same as an expression that is false, but the node says the same. */
  it('fails the branch when the evaluator throws rather than answers', async () => {
    const watched = await watch(
      graph('a knight'),
      {},
      { transform: () => Promise.reject(new Error('the thread is gone')) },
    )

    expect(failureOf(watched, 'if1')).toBe('invalid-expression')
  })

  /**
   * A nameless else port IS somewhere to send the else: the plan wires a nameless handle under
   * `output` (`plan.ts`), and a file is free to leave the name off — the converter pairs its
   * ports by INDEX, not by name. Failing the node there turned a graph Scenario routes into red.
   */
  it('sends the else to a port a file left unnamed', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] },
    ])
    const nameless = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), branch, modelNode('m1', {}, 'model_else')],
        [wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'), wire('m1', 'prompt', 'if1', 'else')],
      ),
      'if1',
      { outputHandles: [...outputHandlesOf(branch).slice(0, 1), { id: 'if1-target-else' }] },
    )

    const watched = await watch(nameless, { model_else: ['a'] }, { transform: decides({}) })

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_else'])
  })

  /**
   * And the same for the port of a case, which is the half that fix left behind: a file is as free
   * to leave a CASE port unnamed as an else one, and the converter pairs both by index. The absent
   * NAME was read as an absent PORT, so a graph Scenario routes came back red — under a message
   * that now names the branch unwired, which claims more than the vague one it replaced.
   */
  it('sends a matched condition to a port a file left unnamed', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
    ])
    const nameless = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), branch, modelNode('m1', {}, 'model_case')],
        [wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'), wire('m1', 'prompt', 'if1', 'case1')],
      ),
      'if1',
      { outputHandles: [{ id: 'if1-target-case1' }, ...outputHandlesOf(branch).slice(1)] },
    )

    const watched = await watch(
      nameless,
      { model_case: ['a'] },
      { transform: async () => ['true'] },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case'])
  })

  /** A thread that dies is not the same as an expression that is false, but the node says the same. */
  it('fails the branch when the evaluator throws rather than answers', async () => {
    const watched = await watch(
      graph('a knight'),
      {},
      { transform: () => Promise.reject(new Error('the thread is gone')) },
    )

    expect(failureOf(watched, 'if1')).toBe('invalid-expression')
  })

  /** Nothing wired into the condition: there is nothing to test and nothing to hand on either. */
  it('takes the else when no wire feeds the condition at all', async () => {
    const lone = graphOf(
      [
        branchNode('if1', [
          { logic: 'and', conditions: [{ field: 'text1', operator: 'isEmpty' }] },
        ]),
        modelNode('m1', {}, 'model_else'),
      ],
      [wire('m1', 'prompt', 'if1', 'else')],
    )

    const watched = await watch(lone, { model_else: ['a'] }, { transform: decides({}) })

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_else'])
  })

  /** A file may carry FEWER ports than blocks: a condition that held with nowhere to send it. */
  it('fails a branch whose matching condition has no port to send to', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
    ])
    const short = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), branch],
        [wire('if1', CONDITIONAL_PORT, 'text1', 'prompt')],
      ),
      'if1',
      { outputHandles: [] },
    )

    const watched = await watch(short, {}, { transform: async () => ['true'] })

    expect(failureOf(watched, 'if1')).toBe('unwired')
  })

  /** A stop pressed while a condition was crossing to the thread leaves the branch idle. */
  it('goes idle when the run is stopped while its condition is being evaluated', async () => {
    const controller = new AbortController()
    const watched = await watch(
      graph('a knight'),
      {},
      {
        signal: controller.signal,
        transform: async () => {
          controller.abort()
          return ['true']
        },
      },
    )

    expect(statusesOf(watched, 'if1')).toContain('idle')
    expect(watched.submitted).toEqual([])
  })

  /**
   * The converter drops approval handles before it counts anything — `// Approval handles are
   * UI-only and must not shift case/else indices.` Left in, block 1 would pair with the approval's
   * port and every branch would route one place off, silently, both ends being well-formed ports.
   */
  it('does not let an approval handle shift which port a branch routes to', async () => {
    const branch = branchNode('if1', [
      { logic: 'and', conditions: [{ field: 'text1', operator: 'isNotEmpty' }] },
    ])
    const shifted = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), branch, modelNode('m1', {}, 'model_case1')],
        [wire('if1', CONDITIONAL_PORT, 'text1', 'prompt'), wire('m1', 'prompt', 'if1', 'case1')],
      ),
      'if1',
      {
        outputHandles: [
          { id: 'if1-target-approval', name: 'approval', type: 'approval' },
          ...outputHandlesOf(branch),
        ],
      },
    )

    const watched = await watch(
      shifted,
      { model_case1: ['asset_1'] },
      { transform: async () => ['true'] },
    )

    expect(watched.submitted.map(one => one.modelId)).toEqual(['model_case1'])
  })

  /**
   * A node that is not a branch produces ONE value and offers it on every port it declares — which
   * is what a flat outcome did before outcomes were keyed. Publishing on the first alone made a
   * reader of a second declared output read as a branch nobody took: grey, silent, and wrong.
   */
  it('offers a producer value on every output it declares, not only the first', async () => {
    const twoOut = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), modelNode('m1', {}, 'model_a')],
        [wire('m1', 'prompt', 'text1', 'second')],
      ),
      'text1',
      {
        outputHandles: [
          { id: 'text1-target-prompt', name: 'output', type: 'text' },
          { id: 'text1-target-second', name: 'second', type: 'text' },
        ],
      },
    )

    const watched = await watch(twoOut, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({ prompt: 'a knight' })
  })

  /** A file may leave a port unnamed; the plan wires it under `output`, and so must the producer. */
  it('reads a nameless output the way the plan resolves one', async () => {
    const nameless = updateNodeData(
      graphOf(
        [textNode('text1', 'a knight'), modelNode('m1', {}, 'model_a')],
        [wire('m1', 'prompt', 'text1', 'prompt')],
      ),
      'text1',
      { outputHandles: [{ id: 'text1-target-prompt' }] },
    )

    const watched = await watch(nameless, { model_a: ['asset_1'] })

    expect(watched.submitted[0]?.body).toEqual({ prompt: 'a knight' })
  })

  /** A file is free to name a port `toString`; reading it off the prototype killed the whole run. */
  it('survives a port named after something Object.prototype carries', async () => {
    const inherited = updateNodeData(
      graphOf(
        [noteNode('note1'), modelNode('m1', {}, 'model_a')],
        [wire('m1', 'prompt', 'note1', 'toString')],
      ),
      'note1',
      { outputHandles: [{ id: 'note1-target-toString', name: 'toString', type: 'text' }] },
    )

    const watched = await watch(inherited, { model_a: ['asset_1'] })

    expect(failureOf(watched, 'm1')).toBe('blocked')
    expect(watched.result.ok).toBe(true)
  })

  /** An expression the evaluator refuses is the node's failure, not a silent fall to the else. */
  it('fails the branch when its condition cannot be evaluated at all', async () => {
    const watched = await watch(graph('a knight'), {}, { transform: async () => null })

    expect(failureOf(watched, 'if1')).toBe('invalid-expression')
    expect(watched.submitted).toEqual([])
  })
})
