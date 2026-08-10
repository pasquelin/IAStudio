import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphState } from '@shared/domain/graph'
import {
  approvalNode as approval,
  graphOf,
  guards,
  modelNode as model,
  textNode as text,
  wire,
} from './graph-fixtures'
import { moveNode, updateNodeData } from './mutations'
import { planGraph, type GraphPlan, type GraphPlanNode } from './plan'
import { parseGraph } from './serialize'

/** The chain the plan is judged on: a text node feeds a generator, which feeds another. */
function chain(prompt = 'a knight', last: Readonly<Record<string, unknown>> = {}): GraphState {
  const graph = graphOf(
    [text('text1'), model('m1'), model('m2', last)],
    [wire('m1', 'prompt', 'text1', 'prompt'), wire('m2', 'prompt', 'm1', 'image')],
  )

  return updateNodeData(graph, 'text1', { value: prompt })
}

function ordered(plan: GraphPlan): readonly GraphPlanNode[] {
  if (!plan.ok) throw new Error(`expected an order, got a cycle on ${plan.cycle.join(', ')}`)
  return plan.order
}

const idsOf = (plan: GraphPlan): readonly string[] => ordered(plan).map(node => node.id)

const hashOf = (plan: GraphPlan, id: string): string => {
  const found = ordered(plan).find(node => node.id === id)
  if (!found) throw new Error(`no node ${id} in the plan`)
  return found.hash
}

describe('ordering a graph', () => {
  it('puts a provider before the node that reads it', () => {
    expect(idsOf(planGraph(chain()))).toEqual(['text1', 'm1', 'm2'])
  })

  it('reads the edge the way Scenario points it, from consumer to provider', () => {
    // Wired the intuitive way round, this graph would order `m1` first and run backwards.
    const graph = graphOf([model('m1'), text('text1')], [wire('m1', 'prompt', 'text1', 'prompt')])

    expect(idsOf(planGraph(graph))).toEqual(['text1', 'm1'])
  })

  it('keeps the graph order between two nodes that wait on nothing', () => {
    const graph = graphOf([text('text2'), text('text1')], [])

    expect(idsOf(planGraph(graph))).toEqual(['text2', 'text1'])
  })

  it('holds a node back until every one of its providers has run', () => {
    const joined = graphOf(
      [text('text1'), text('text2'), model('m1')],
      [wire('m1', 'prompt', 'text1', 'prompt'), wire('m1', 'style', 'text2', 'prompt')],
    )

    expect(idsOf(planGraph(joined))).toEqual(['text1', 'text2', 'm1'])
  })

  it('plans a graph nothing is wired in', () => {
    expect(idsOf(planGraph(graphOf([text('text1')], [])))).toEqual(['text1'])
    expect(idsOf(planGraph(graphOf([], [])))).toEqual([])
  })

  it('ignores an edge whose provider is no longer in the graph', () => {
    // Left counted, its consumer would wait for ever and a straight graph would read as a cycle.
    const orphaned = graphOf([model('m1')], [wire('m1', 'prompt', 'text1', 'prompt')])

    expect(idsOf(planGraph(orphaned))).toEqual(['m1'])
  })
})

describe('refusing a cycle', () => {
  it('names the nodes caught in the loop instead of looping', () => {
    const looped = graphOf(
      [model('m1'), model('m2')],
      [wire('m1', 'prompt', 'm2', 'image'), wire('m2', 'prompt', 'm1', 'image')],
    )

    expect(planGraph(looped)).toEqual({ ok: false, cycle: ['m1', 'm2'] })
  })

  it('names a node wired to itself', () => {
    const graph = graphOf([model('m1')], [wire('m1', 'prompt', 'm1', 'image')])

    expect(planGraph(graph)).toEqual({ ok: false, cycle: ['m1'] })
  })

  it('leaves out a node the cycle merely blocks', () => {
    // `m3` reads the loop without being in it: naming it would send the user to a node that is
    // fine, and Kahn alone leaves it behind with the other two.
    const graph = graphOf(
      [model('m1'), model('m2'), model('m3')],
      [
        wire('m1', 'prompt', 'm2', 'image'),
        wire('m2', 'prompt', 'm1', 'image'),
        wire('m3', 'prompt', 'm2', 'image'),
      ],
    )

    expect(planGraph(graph)).toEqual({ ok: false, cycle: ['m1', 'm2'] })
  })

  it('plans nothing when the graph loops, rather than half of it', () => {
    const graph = graphOf(
      [text('text1'), model('m1'), model('m2')],
      [wire('m1', 'prompt', 'm2', 'image'), wire('m2', 'prompt', 'm1', 'image')],
    )

    expect(planGraph(graph).ok).toBe(false)
  })
})

describe('resolving what feeds a node', () => {
  it('keys an input by the port name, which is the model field it fills', () => {
    expect(ordered(planGraph(chain()))[1]?.inputs).toEqual({
      prompt: { node: 'text1', output: 'output' },
    })
  })

  it('leaves a node nothing is wired into with no inputs at all', () => {
    expect(ordered(planGraph(chain()))[0]?.inputs).toEqual({})
  })

  it('still orders on an edge that names no port, and reads no input from it', () => {
    // `parseEdge` keeps an edge whose handles are missing — the two ends are what it requires.
    // The dependency is real even though there is no port to fill.
    const graph = graphOf(
      [text('text1'), model('m1')],
      [{ id: 'e1', source: 'm1', target: 'text1' }],
    )
    const plan = planGraph(graph)

    expect(idsOf(plan)).toEqual(['text1', 'm1'])
    expect(ordered(plan)[1]?.inputs).toEqual({})
  })

  it('falls back to the handle id when the node no longer carries that port', () => {
    const graph = graphOf([text('text1'), model('m1')], [wire('m1', 'gone', 'text1', 'prompt')])

    expect(ordered(planGraph(graph))[1]?.inputs).toEqual({
      'm1-source-gone': { node: 'text1', output: 'output' },
    })
  })
})

describe('hashing a node', () => {
  it('gives two nodes holding the same thing two different hashes', () => {
    // Generation is stochastic: two generators on the same prompt are asking for two pictures.
    const twins = graphOf(
      [model('m1', { prompt: 'a knight' }), model('m2', { prompt: 'a knight' })],
      [],
    )
    const plan = planGraph(twins)

    expect(hashOf(plan, 'm1')).not.toBe(hashOf(plan, 'm2'))
  })

  it('reruns only the node whose prompt changed', () => {
    const before = planGraph(chain('a knight', { prompt: 'in ink' }))
    const after = planGraph(chain('a knight', { prompt: 'in charcoal' }))

    expect(hashOf(after, 'text1')).toBe(hashOf(before, 'text1'))
    expect(hashOf(after, 'm1')).toBe(hashOf(before, 'm1'))
    expect(hashOf(after, 'm2')).not.toBe(hashOf(before, 'm2'))
  })

  it('reruns everything downstream when a provider changes', () => {
    const before = planGraph(chain('a knight'))
    const after = planGraph(chain('a castle'))

    expect(hashOf(after, 'text1')).not.toBe(hashOf(before, 'text1'))
    expect(hashOf(after, 'm1')).not.toBe(hashOf(before, 'm1'))
    expect(hashOf(after, 'm2')).not.toBe(hashOf(before, 'm2'))
  })

  it('ignores where a node sits and what it is called', () => {
    const graph = chain()
    const moved = updateNodeData(moveNode(graph, 'm2', { x: 900, y: 40 }), 'm2', {
      title: 'renamed',
      group: 'box-1',
    })

    expect(hashOf(planGraph(moved), 'm2')).toBe(hashOf(planGraph(graph), 'm2'))
  })

  it('ignores the ports, which the model the node already names decides', () => {
    const graph = chain()
    const stripped = updateNodeData(graph, 'text1', { outputHandles: [] })

    expect(hashOf(planGraph(stripped), 'text1')).toBe(hashOf(planGraph(graph), 'text1'))
  })

  it('counts what marks a node as an output of the workflow as nothing it computes', () => {
    const graph = chain()
    const marked = updateNodeData(graph, 'm2', { isOutput: true })

    expect(hashOf(planGraph(marked), 'm2')).toBe(hashOf(planGraph(graph), 'm2'))
  })

  it('counts the model a generator names', () => {
    const graph = chain()
    const swapped = updateNodeData(graph, 'm2', { modelId: 'model_sd' })

    expect(hashOf(planGraph(swapped), 'm2')).not.toBe(hashOf(planGraph(graph), 'm2'))
  })

  it('does not change when a form is written in another order', () => {
    const one = graphOf([model('m1', { prompt: 'a knight', width: 512 })], [])
    const other = graphOf([model('m1', { width: 512, prompt: 'a knight' })], [])

    expect(hashOf(planGraph(other), 'm1')).toBe(hashOf(planGraph(one), 'm1'))
  })

  it('counts which port a wire lands on', () => {
    const one = graphOf([text('text1'), model('m1')], [wire('m1', 'prompt', 'text1', 'prompt')])
    const other = graphOf([text('text1'), model('m1')], [wire('m1', 'style', 'text1', 'prompt')])

    expect(hashOf(planGraph(other), 'm1')).not.toBe(hashOf(planGraph(one), 'm1'))
  })

  it('counts a field a file names after a member of Object.prototype', () => {
    // `parseGraph` validates the node, not its `data`, so a file decides what lands there. Read
    // with `in` rather than `hasOwn`, such a field reads as excluded and leaves the key silently.
    const held = (data: Readonly<Record<string, unknown>>) =>
      parseGraph({ nodes: [{ id: 'text1', type: 'text', position: { x: 0, y: 0 }, data }] })

    expect(hashOf(planGraph(held({ toString: 'one' })), 'text1')).not.toBe(
      hashOf(planGraph(held({ toString: 'other' })), 'text1'),
    )
  })

  it('does not change when two wires into one node are written in the other order', () => {
    const feeds: readonly GraphEdge[] = [
      wire('m1', 'prompt', 'text1', 'prompt'),
      wire('m1', 'style', 'text2', 'prompt'),
    ]
    const nodes = [text('text1'), text('text2'), model('m1')]

    expect(hashOf(planGraph(graphOf(nodes, [...feeds].reverse())), 'm1')).toBe(
      hashOf(planGraph(graphOf(nodes, feeds)), 'm1'),
    )
  })
})

describe('reading the cache', () => {
  it('marks a node whose hash is already held', () => {
    const plan = planGraph(chain())
    const known = hashOf(plan, 'text1')
    const cached = planGraph(chain(), new Map([[known, ['asset_1']]]))

    expect(ordered(cached).map(node => [node.id, node.cached])).toEqual([
      ['text1', true],
      ['m1', false],
      ['m2', false],
    ])
  })

  it('holds nothing cached without a cache', () => {
    expect(ordered(planGraph(chain())).every(node => !node.cached)).toBe(true)
  })
})

/**
 * What the SDK's converter writes into a flow, brought forward into the plan: everything reading
 * a guarded node depends on its approval. Here rather than in the executor because it decides the
 * ORDER — two consumers of one guarded node are siblings, and one of them could otherwise be
 * handed its inputs before the question had been asked.
 */
describe('waiting on an approval', () => {
  /** `m1` feeds `m2`, and `approval1` stands on `m1`. */
  const guarded = (): GraphState =>
    graphOf(
      [model('m1'), model('m2'), approval('approval1')],
      [wire('m2', 'prompt', 'm1', 'image'), guards('approval1', 'm1')],
    )

  it('puts the approval before what reads the node it guards', () => {
    expect(idsOf(planGraph(guarded()))).toEqual(['m1', 'approval1', 'm2'])
  })

  it('tells the consumer which approval it waits on', () => {
    const plan = planGraph(guarded())

    expect(ordered(plan).map(node => [node.id, node.awaits])).toEqual([
      ['m1', []],
      ['approval1', []],
      ['m2', ['approval1']],
    ])
  })

  /** The wire naming what it guards is not a wait on its own answer — that would be a loop. */
  it('never makes an approval wait on itself', () => {
    expect(idsOf(planGraph(guarded()))).toContain('approval1')
  })

  it('leaves the guarded node reading nothing of the approval', () => {
    const plan = planGraph(guarded())

    expect(ordered(plan).find(node => node.id === 'm2')?.inputs).toEqual({
      prompt: { node: 'm1', output: 'output' },
    })
  })

  /**
   * A question put to a person says nothing about what a node computes, so it must not change the
   * key a result is filed under — or approving one would invalidate every cached node below it.
   */
  it('hashes a consumer the same with the approval and without it', () => {
    const plain = graphOf([model('m1'), model('m2')], [wire('m2', 'prompt', 'm1', 'image')])

    expect(hashOf(planGraph(guarded()), 'm2')).toBe(hashOf(planGraph(plain), 'm2'))
  })

  /**
   * The order of `graph.nodes` is what seeds Kahn's queue, so a graph holding the consumer FIRST
   * and the approval LAST is the case where a missing dependency would show: the executor awaits
   * `settled.get(approval)`, and an approval planned after its consumer would hand it
   * `undefined` — read as a refusal, and the branch would go `blocked` on a question nobody was
   * ever asked.
   */
  it('puts the approval first even where the graph holds it last', () => {
    const reversed = graphOf(
      [model('m2'), model('m1'), approval('approval1')],
      [wire('m2', 'prompt', 'm1', 'image'), guards('approval1', 'm1')],
    )

    expect(idsOf(planGraph(reversed))).toEqual(['m1', 'approval1', 'm2'])
  })

  /**
   * The converter never makes one approval depend on another — it pushes their flow items after
   * it has finished walking the flow, with `dependsOn: [approvedFlowId]` and nothing else. Here,
   * `approval1` reads `m1` through its own guard wire, and `m1` is guarded by `approval2`.
   */
  it('never makes one approval wait on another', () => {
    const rivals = graphOf(
      [model('m1'), approval('approval1'), approval('approval2')],
      [guards('approval1', 'm1'), guards('approval2', 'm1')],
    )
    const plan = planGraph(rivals)

    expect(ordered(plan).map(node => [node.id, node.awaits])).toEqual([
      ['m1', []],
      ['approval1', []],
      ['approval2', []],
    ])
  })

  it('waits once where two wires join the same guarded node', () => {
    const twice = graphOf(
      [model('m1'), model('m2'), approval('approval1')],
      [
        wire('m2', 'prompt', 'm1', 'image'),
        wire('m2', 'style', 'm1', 'image'),
        guards('approval1', 'm1'),
      ],
    )

    expect(ordered(planGraph(twice)).find(node => node.id === 'm2')?.awaits).toEqual(['approval1'])
  })

  /**
   * The approval is IN the loop, not a bystander of one: `m2` waits on it, it waits on `m1`, and
   * `m1` reads `m2`. Naming only the two generators would send the user to a pair of nodes that
   * are wired perfectly well on their own.
   */
  it('names the approval among the nodes caught in the loop it closes', () => {
    const looped = graphOf(
      [model('m1'), model('m2'), approval('approval1')],
      [
        wire('m1', 'prompt', 'm2', 'image'),
        wire('m2', 'prompt', 'm1', 'image'),
        guards('approval1', 'm1'),
      ],
    )
    const plan = planGraph(looped)

    expect(plan.ok).toBe(false)
    if (!plan.ok) expect(plan.cycle).toEqual(['m1', 'm2', 'approval1'])
  })
})
