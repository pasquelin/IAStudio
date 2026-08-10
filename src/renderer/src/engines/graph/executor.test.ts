import { describe, expect, it, vi } from 'vitest'
import type { GraphNode, GraphNodeRun, GraphState } from '@shared/domain/graph'
import { runGraph, type GraphRunPorts, type GraphRunResult } from './executor'
import { approvalNode, graphOf, guards, modelNode, textNode, wire } from './graph-fixtures'
import { handleId } from './handles'
import { updateNodeData } from './mutations'
import { planGraph, type GraphCache } from './plan'

type Submitted = { modelId: string; body: Record<string, unknown> }

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
      report: (nodeId, run) => {
        const held = reported.get(nodeId)
        if (held) held.push(run)
        else reported.set(nodeId, [run])
      },
      signal: controller.signal,
    })

    expect(reported.get('m2')?.map(run => run.status)).toEqual(['idle'])
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
