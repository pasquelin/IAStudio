import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphState } from '@shared/domain/graph'
import { graphOf, modelNode as model, textNode as text, wire } from './graph-fixtures'
import { moveNode, updateNodeData } from './mutations'
import { planGraph, type GraphPlan, type GraphPlanNode } from './plan'
import { parseGraph } from './serialize'

/** The chain the plan is judged on: a text node feeds a generator, which feeds another. */
function chain(prompt = 'a knight', last: Readonly<Record<string, unknown>> = {}): GraphState {
  const graph = graphOf(
    [text('text1'), model('m1'), model('m2', last)],
    [wire('m1', 'prompt', 'text1', 'output'), wire('m2', 'prompt', 'm1', 'image')],
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
    const graph = graphOf([model('m1'), text('text1')], [wire('m1', 'prompt', 'text1', 'output')])

    expect(idsOf(planGraph(graph))).toEqual(['text1', 'm1'])
  })

  it('keeps the graph order between two nodes that wait on nothing', () => {
    const graph = graphOf([text('text2'), text('text1')], [])

    expect(idsOf(planGraph(graph))).toEqual(['text2', 'text1'])
  })

  it('holds a node back until every one of its providers has run', () => {
    const joined = graphOf(
      [text('text1'), text('text2'), model('m1')],
      [wire('m1', 'prompt', 'text1', 'output'), wire('m1', 'style', 'text2', 'output')],
    )

    expect(idsOf(planGraph(joined))).toEqual(['text1', 'text2', 'm1'])
  })

  it('plans a graph nothing is wired in', () => {
    expect(idsOf(planGraph(graphOf([text('text1')], [])))).toEqual(['text1'])
    expect(idsOf(planGraph(graphOf([], [])))).toEqual([])
  })

  it('ignores an edge whose provider is no longer in the graph', () => {
    // Left counted, its consumer would wait for ever and a straight graph would read as a cycle.
    const orphaned = graphOf([model('m1')], [wire('m1', 'prompt', 'text1', 'output')])

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
      prompt: { node: 'text1', handle: 'text1-target-output' },
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
    const graph = graphOf([text('text1'), model('m1')], [wire('m1', 'gone', 'text1', 'output')])

    expect(ordered(planGraph(graph))[1]?.inputs).toEqual({
      'm1-source-gone': { node: 'text1', handle: 'text1-target-output' },
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
    const one = graphOf([text('text1'), model('m1')], [wire('m1', 'prompt', 'text1', 'output')])
    const other = graphOf([text('text1'), model('m1')], [wire('m1', 'style', 'text1', 'output')])

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
      wire('m1', 'prompt', 'text1', 'output'),
      wire('m1', 'style', 'text2', 'output'),
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
