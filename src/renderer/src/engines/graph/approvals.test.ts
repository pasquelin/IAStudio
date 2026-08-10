import { describe, expect, it } from 'vitest'
import { approvalsOf } from './approvals'
import { approvalNode, graphOf, guards, modelNode, textNode, wire } from './graph-fixtures'

describe('reading the approvals of a graph', () => {
  it('names the node an approval guards', () => {
    const graph = graphOf([modelNode('m1'), approvalNode('approval1')], [guards('approval1', 'm1')])

    expect([...approvalsOf(graph)]).toEqual([['m1', 'approval1']])
  })

  it('answers nothing for a graph with no approval in it', () => {
    const graph = graphOf(
      [textNode('text1'), modelNode('m1')],
      [wire('m1', 'prompt', 'text1', 'prompt')],
    )

    expect(approvalsOf(graph).size).toBe(0)
  })

  /**
   * An approval dropped on the canvas and left unwired guards nothing at all: it compiles away,
   * and a run stopping on it would be a question about a node the user never named.
   */
  it('ignores an approval wired to nothing', () => {
    const graph = graphOf([modelNode('m1'), approvalNode('approval1')], [])

    expect(approvalsOf(graph).size).toBe(0)
  })

  /**
   * The port id is the whole of what the converter matches — it builds the string itself — so a
   * wire leaving an approval through anything else is not an approval wire.
   */
  it('ignores a wire leaving an approval through another port', () => {
    const graph = graphOf(
      [modelNode('m1'), approvalNode('approval1')],
      [wire('approval1', 'conditional', 'm1', 'image')],
    )

    expect(approvalsOf(graph).size).toBe(0)
  })

  /**
   * `parseGraph` keeps an edge whose ends a file names and the graph no longer holds — the plan
   * filters those, and the converter checks the guarded node exists before recording anything.
   * Left in, the map would claim a guard on a node nobody can see.
   */
  it('ignores a guard on a node the graph no longer holds', () => {
    const graph = graphOf([approvalNode('approval1')], [guards('approval1', 'm1')])

    expect(approvalsOf(graph).size).toBe(0)
  })

  it('takes the first wire when an approval names two nodes', () => {
    const graph = graphOf(
      [modelNode('m1'), modelNode('m2'), approvalNode('approval1')],
      [guards('approval1', 'm1'), guards('approval1', 'm2')],
    )

    expect([...approvalsOf(graph)]).toEqual([['m1', 'approval1']])
  })

  /** Transcribed from the converter, which overwrites its map: the last node in order wins. */
  it('keeps the last approval when two of them guard one node', () => {
    const graph = graphOf(
      [modelNode('m1'), approvalNode('approval1'), approvalNode('approval2')],
      [guards('approval1', 'm1'), guards('approval2', 'm1')],
    )

    expect([...approvalsOf(graph)]).toEqual([['m1', 'approval2']])
  })
})
