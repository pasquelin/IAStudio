import { describe, expect, it } from 'vitest'
import { drawsNode, hideIn, isolating, NOTHING_ISOLATED } from './isolation'
import { isolationFor, toggledIsolation } from './sceneVisibility'
import { meshNode } from './scene-fixtures'

const nodes = [
  meshNode('group'),
  meshNode('child', 'group'),
  meshNode('grandchild', 'child'),
  meshNode('other'),
]

describe('isolating a selection of a scene', () => {
  it('keeps what hangs under what was chosen', () => {
    const held = isolationFor(nodes, ['group'])

    expect(drawsNode(held, 'child', true)).toBe(true)
    expect(drawsNode(held, 'grandchild', true)).toBe(true)
    expect(drawsNode(held, 'other', true)).toBe(false)
  })

  // three.js hides a whole subtree with its parent: a mesh kept visible under a group that is not
  // would still be invisible, so an isolation that dropped the ancestors would black out exactly
  // what it was asked to show.
  it('keeps the ancestors what was chosen hangs from', () => {
    const held = isolationFor(nodes, ['grandchild'])

    expect(drawsNode(held, 'grandchild', true)).toBe(true)
    expect(drawsNode(held, 'child', true)).toBe(true)
    expect(drawsNode(held, 'group', true)).toBe(true)
    expect(drawsNode(held, 'other', true)).toBe(false)
  })

  it('leaves a node its author hid hidden, isolated or not', () => {
    expect(drawsNode(isolationFor(nodes, ['group']), 'child', false)).toBe(false)
  })

  it('isolates nothing on an empty selection', () => {
    expect(drawsNode(isolationFor(nodes, []), 'other', true)).toBe(true)
  })
})

describe('the isolate gesture', () => {
  it('goes in, and comes back out on the second press', () => {
    const inside = toggledIsolation(NOTHING_ISOLATED, nodes, ['group'])
    expect(isolating(inside)).toBe(true)

    expect(toggledIsolation(inside, nodes, ['group'])).toEqual(NOTHING_ISOLATED)
  })

  /**
   * Read through `isolating` rather than through the isolation alone: somebody who hid two things
   * by hand is hiding things, and the key that gets them out of an isolation is the one they
   * expect to give them the scene back.
   */
  it('gets out of a viewport that is only hiding, with no isolation running', () => {
    const hiding = hideIn(NOTHING_ISOLATED, ['other'])

    expect(toggledIsolation(hiding, nodes, ['group'])).toEqual(NOTHING_ISOLATED)
  })
})
