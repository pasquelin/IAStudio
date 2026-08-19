import { describe, expect, it } from 'vitest'
import { drawsNode, hideIn, isolate, isolating, NOTHING_ISOLATED } from './isolation'

const noRelations = (): readonly string[] => []

const isolated = (ids: readonly string[], held = NOTHING_ISOLATED) =>
  isolate(held, ids, noRelations, noRelations)

describe('isolation', () => {
  it('leaves every node drawn when nothing is isolated', () => {
    expect(drawsNode(NOTHING_ISOLATED, 'a', true)).toBe(true)
    expect(isolating(NOTHING_ISOLATED)).toBe(false)
  })

  it('never draws what the document hides, isolated or not', () => {
    expect(drawsNode(NOTHING_ISOLATED, 'b', false)).toBe(false)
    expect(drawsNode(isolated(['b']), 'b', false)).toBe(false)
  })

  it('restores the exact visibility that went in, and not all-visible', () => {
    // A visible / B hidden by its author / C visible — the case the whole module exists for.
    const held = isolated(['a'])
    expect(drawsNode(held, 'a', true)).toBe(true)
    expect(drawsNode(held, 'b', false)).toBe(false)
    expect(drawsNode(held, 'c', true)).toBe(false)

    expect(drawsNode(NOTHING_ISOLATED, 'a', true)).toBe(true)
    expect(drawsNode(NOTHING_ISOLATED, 'b', false)).toBe(false)
    expect(drawsNode(NOTHING_ISOLATED, 'c', true)).toBe(true)
  })

  it('keeps the children of what it isolates, and the parents it hangs from', () => {
    const held = isolate(
      NOTHING_ISOLATED,
      ['model'],
      (id: string) => (id === 'model' ? ['mesh'] : []),
      (id: string) => (id === 'model' ? ['group'] : []),
    )

    expect(drawsNode(held, 'mesh', true)).toBe(true)
    expect(drawsNode(held, 'group', true)).toBe(true)
    expect(drawsNode(held, 'other', true)).toBe(false)
  })

  it('leaves what it was handed alone rather than blacking the viewport out on nothing', () => {
    const hiding = hideIn(NOTHING_ISOLATED, ['a'])

    expect(isolated([])).toEqual(NOTHING_ISOLATED)
    expect(isolated([], hiding)).toBe(hiding)
  })

  it('stacks hiding on top of an isolation instead of replacing it', () => {
    const held = hideIn(isolated(['a', 'b']), ['b'])

    expect(drawsNode(held, 'a', true)).toBe(true)
    expect(drawsNode(held, 'b', true)).toBe(false)
    expect(isolating(held)).toBe(true)
  })

  // The other direction, which the first writing got wrong: hiding A then isolating B brought A
  // back, so isolating was quietly a way of undoing a hide nobody asked to undo.
  it('keeps what was hidden by hand when an isolation starts', () => {
    const held = isolated(['a', 'b'], hideIn(NOTHING_ISOLATED, ['b']))

    expect(drawsNode(held, 'a', true)).toBe(true)
    expect(drawsNode(held, 'b', true)).toBe(false)
  })

  it('counts a hidden node as hiding even with no isolation running', () => {
    expect(isolating(hideIn(NOTHING_ISOLATED, ['a']))).toBe(true)
  })
})
