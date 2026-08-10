import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, type GraphHandleInput, type GraphHandleOutput } from '@shared/domain/graph'
import type { FieldDescriptor } from '@shared/domain/model'
import { edgeBetween } from './connect'
import { createModelNode, createNode } from './factory'
import {
  approvalNode,
  branchNode,
  modelNode,
  textNode,
  transformNode,
  wire,
} from './graph-fixtures'
import { handleId, inputHandlesOf, outputHandlesOf } from './handles'

/**
 * The lock this file exists for.
 *
 * A fixture is allowed to say LESS than the factory — most suites need one port, not every port a
 * generator carries. It is not allowed to say something ELSE. `textNode` used to output through
 * `<id>-target-output` typed `prompt` where `createNode` builds `<id>-target-prompt` typed `text`,
 * and that one divergence made three lots blind to a refused connection: every suite wired a node
 * the studio cannot draw, so every suite stayed green while the canvas said no.
 *
 * Compared by the part of the handle id that FOLLOWS the node id, since the factory names its own
 * nodes (`imageGenerator1`) and a fixture is called whatever its suite needs.
 */
type Port = { port: string; name: string | undefined; type: unknown }

const portsOf = (
  nodeId: string,
  handles: readonly (GraphHandleInput | GraphHandleOutput)[],
): Port[] =>
  handles.map(handle => ({
    port: handle.id.startsWith(nodeId) ? handle.id.slice(nodeId.length) : handle.id,
    name: handle.name,
    type: handle.type,
  }))

const PROMPT: FieldDescriptor = {
  key: 'prompt',
  kind: 'text',
  label: 'Prompt',
  required: true,
  promptSpark: true,
}

describe('the fixtures say what the factory builds', () => {
  it('gives a text node the port createNode gives it, spelling and type', () => {
    const built = createNode(EMPTY_GRAPH, 'text', { x: 0, y: 0 })

    expect(portsOf('text1', outputHandlesOf(textNode('text1')))).toEqual(
      portsOf(built.id, outputHandlesOf(built)),
    )
  })

  /**
   * The one this suite was missing, and the executor's whole branch suite hangs off it.
   *
   * Compared against a `transformText`, not an `ifElse`: the factory REFUSES to build the latter
   * — deliberately, it has no palette entry — but both carry the same `conditionalInput`, so the
   * spelling is comparable all the same. A branch fixture typed anything else would run a graph
   * whose port is not the one the studio writes.
   */
  it('gives a branch the conditional port the factory writes, type included', () => {
    const built = createNode(EMPTY_GRAPH, 'transformText', { x: 0, y: 0 })
    const conditionalOf = (nodeId: string, ports: readonly GraphHandleInput[]): Port[] =>
      portsOf(nodeId, ports).filter(port => port.name === 'conditional')

    expect(conditionalOf('if1', inputHandlesOf(branchNode('if1', [])))).toEqual(
      conditionalOf(built.id, inputHandlesOf(built)),
    )
  })

  it('gives an approval the port createNode gives it, and no output either', () => {
    const built = createNode(EMPTY_GRAPH, 'approval', { x: 0, y: 0 })
    const fixture = approvalNode('approval1')

    expect(portsOf('approval1', inputHandlesOf(fixture))).toEqual(
      portsOf(built.id, inputHandlesOf(built)),
    )
    expect(outputHandlesOf(fixture)).toEqual(outputHandlesOf(built))
  })

  it('gives a transform both ports createNode gives it, the untyped one included', () => {
    const built = createNode(EMPTY_GRAPH, 'transformText', { x: 0, y: 0 })
    const fixture = transformNode('transformText1')

    expect(portsOf('transformText1', inputHandlesOf(fixture))).toEqual(
      portsOf(built.id, inputHandlesOf(built)),
    )
    expect(portsOf('transformText1', outputHandlesOf(fixture))).toEqual(
      portsOf(built.id, outputHandlesOf(built)),
    )
  })

  it('gives a generator ports createModelNode would recognise', () => {
    const built = createModelNode(EMPTY_GRAPH, 'image', 'model_flux', [PROMPT], { x: 0, y: 0 })
    const fixture = modelNode('m1')

    // A subset, deliberately: the factory also wires a `conditional` port that most suites do not
    // care about. What matters is that no port of the fixture contradicts one of the factory's.
    for (const port of portsOf('m1', inputHandlesOf(fixture))) {
      expect(portsOf(built.id, inputHandlesOf(built))).toContainEqual(port)
    }

    expect(portsOf('m1', outputHandlesOf(fixture))).toEqual(
      portsOf(built.id, outputHandlesOf(built)),
    )
  })

  /**
   * The same lock, on the wire rather than on the node — and the reason `wire` names its ends by
   * FIELD while `edgeBetween` names them by handle id: the shorthand has to land on the same edge.
   */
  it('gives a wire the edge the canvas builds from the same two ports', () => {
    expect(wire('model1', 'prompt', 'text1', 'prompt')).toEqual(
      edgeBetween(
        'model1',
        handleId('model1', 'source', 'prompt'),
        'text1',
        handleId('text1', 'target', 'prompt'),
      ),
    )
  })

  /**
   * An id built from the two NODES collides the moment one node reads another twice — a generator
   * whose prompt and mask leave by two branches of one `ifElse`. `disconnect` then drops BOTH wires
   * on either id, so a suite cutting one would be reasoning about a graph the store never held.
   */
  it('tells two wires between the same pair of nodes apart', () => {
    const prompt = wire('model1', 'prompt', 'ifElse1', 'case1')
    const mask = wire('model1', 'mask', 'ifElse1', 'case2')

    expect(prompt.id).not.toBe(mask.id)
  })
})
