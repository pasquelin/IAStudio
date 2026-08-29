// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INTERACTION,
  DEFAULT_PLACEMENT,
  DEFAULT_STYLE,
  type UiElement,
  type UiScreen,
} from '@shared/domain/ui'
import {
  childrenOf,
  contains,
  elementById,
  flattened,
  mapped,
  parentOf,
  reparented,
  withElement,
  withoutElement,
} from './uiTree'

const shared = {
  name: '',
  visible: true,
  enabled: true,
  locked: false,
  place: DEFAULT_PLACEMENT,
  style: DEFAULT_STYLE,
  interaction: DEFAULT_INTERACTION,
}

const panel = (id: string, children: readonly UiElement[] = []): UiElement => ({
  ...shared,
  id,
  type: 'panel',
  children,
})

const spacer = (id: string): UiElement => ({ ...shared, id, type: 'spacer' })

/**
 * root
 * ├ a ─ a1
 * ├ b
 * └ leaf
 */
const tree = (): UiScreen => ({
  ...shared,
  id: 'root',
  type: 'screen',
  children: [panel('a', [panel('a1')]), panel('b'), spacer('leaf')],
})

describe('walking an interface', () => {
  it('finds an element at any depth, and nothing for a name it does not hold', () => {
    expect(elementById(tree(), 'a1')?.id).toBe('a1')
    expect(elementById(tree(), 'root')?.id).toBe('root')
    expect(elementById(tree(), 'nowhere')).toBeNull()
  })

  it('names the parent of an element, and none for the root', () => {
    expect(parentOf(tree(), 'a1')?.id).toBe('a')
    expect(parentOf(tree(), 'root')).toBeNull()
  })

  it('flattens parents before their children, which is the order a renderer paints in', () => {
    expect(flattened(tree()).map(one => one.id)).toEqual(['root', 'a', 'a1', 'b', 'leaf'])
  })

  it('answers no children for an element that holds none', () => {
    expect(childrenOf(spacer('x'))).toEqual([])
  })

  it('says whether one element sits under another', () => {
    expect(contains(tree(), 'a', 'a1')).toBe(true)
    expect(contains(tree(), 'b', 'a1')).toBe(false)
  })
})

describe('rebuilding an interface', () => {
  it('lays an element inside a parent at the index asked for', () => {
    const root = withElement(tree(), 'root', spacer('new'), 1)

    expect(root.children.map(one => one.id)).toEqual(['a', 'new', 'b', 'leaf'])
  })

  it('appends past the end rather than refusing', () => {
    const root = withElement(tree(), 'root', spacer('new'))

    expect(root.children.map(one => one.id)).toEqual(['a', 'b', 'leaf', 'new'])
  })

  it('leaves the tree alone where the parent holds no children', () => {
    const before = tree()

    expect(withElement(before, 'leaf', spacer('new'))).toEqual(before)
  })

  it('takes an element and everything under it', () => {
    const root = withoutElement(tree(), 'a')

    expect(flattened(root).map(one => one.id)).toEqual(['root', 'b', 'leaf'])
  })

  /** What lets a command hold the tree it replaced without having copied anything. */
  it('hands back the very same tree when nothing changed', () => {
    const before = tree()

    expect(mapped(before, 'nowhere', element => element)).toBe(before)
  })

  it('refuses a change that would leave the root something other than a screen', () => {
    const before = tree()

    expect(mapped(before, 'root', () => null)).toBe(before)
  })
})

describe('moving an element', () => {
  it('puts it under its new parent', () => {
    const root = reparented(tree(), 'leaf', 'a')

    expect(flattened(root).map(one => one.id)).toEqual(['root', 'a', 'a1', 'leaf', 'b'])
  })

  /**
   * The index names a gap in the tree as it stands, so a row dragged onto the third position of
   * its own parent arrives where the pointer was — not one short of it.
   */
  it('counts the index in the tree the drag started from, not the one it lands in', () => {
    const root = reparented(tree(), 'a', 'root', 2)

    expect(root.children.map(one => one.id)).toEqual(['b', 'a', 'leaf'])
  })

  it('refuses to drop a parent inside its own child', () => {
    const before = tree()

    expect(reparented(before, 'a', 'a1')).toBe(before)
    expect(reparented(before, 'a', 'a')).toBe(before)
  })

  it('refuses a parent that holds no children', () => {
    const before = tree()

    expect(reparented(before, 'b', 'leaf')).toBe(before)
  })

  it('refuses to move something the tree does not hold', () => {
    const before = tree()

    expect(reparented(before, 'nowhere', 'a')).toBe(before)
  })
})
