import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, type GraphHandleInput, type GraphHandleOutput } from '@shared/domain/graph'
import type { FieldDescriptor } from '@shared/domain/model'
import { createModelNode, createNode } from './factory'
import { approvalNode, modelNode, textNode, transformNode } from './graph-fixtures'
import { inputHandlesOf, outputHandlesOf } from './handles'

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
})
