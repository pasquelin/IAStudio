// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import type { UiBox, UiBoxes, UiElement, UiScreen } from '@shared/domain/ui'
import type { UiFrame } from '../ports/uiRenderPort'
import { pickAt } from './uiPick'
import { uiDocumentOf, uiPanel, uiScreen } from './ui-fixtures'

const BOXES: readonly [string, UiBox][] = [
  ['root', { x: 0, y: 0, width: 100, height: 100 }],
  ['a', { x: 0, y: 0, width: 60, height: 60 }],
  ['a1', { x: 10, y: 10, width: 20, height: 20 }],
  // Overlapping `a` on its right half, and reaching past it: the two say which sibling wins.
  ['b', { x: 40, y: 0, width: 60, height: 60 }],
]

const framed = (
  root: UiScreen,
  ui = 'hud',
  order = 0,
  boxes: UiBoxes = new Map(BOXES),
): UiFrame => ({
  ui,
  document: uiDocumentOf(root),
  boxes,
  values: new Map(),
  order,
})

/**
 * root ─┬ a ─ a1
 *       └ b        — `b` after `a`, both covering the same corner.
 */
const tree = (change: (element: UiElement) => UiElement = one => one): UiScreen =>
  uiScreen([change(uiPanel('a', [uiPanel('a1')])), uiPanel('b')])

describe('what a point in an interface landed on', () => {
  it('answers the deepest element under it', () => {
    expect(pickAt([framed(tree())], { x: 15, y: 15 })).toEqual({ ui: 'hud', element: 'a1' })
  })

  it('answers the later sibling where two cover the same place', () => {
    expect(pickAt([framed(tree())], { x: 45, y: 45 })).toEqual({ ui: 'hud', element: 'b' })
  })

  it('answers the root where nothing else reaches, and nothing outside it', () => {
    expect(pickAt([framed(tree())], { x: 80, y: 80 })).toEqual({ ui: 'hud', element: 'root' })
    expect(pickAt([framed(tree())], { x: 200, y: 5 })).toBeNull()
  })

  /** The pile, and it is `order` that says it — not the order the frames were handed over in. */
  it('answers the interface highest in the pile', () => {
    const under = framed(uiScreen([uiPanel('a')]), 'hud', 5)
    const over = framed(uiScreen([uiPanel('a')]), 'menu', 9)

    expect(pickAt([over, under], { x: 15, y: 15 })?.ui).toBe('menu')
  })

  it('lets an invisible element and everything under it be reached through', () => {
    const hidden = tree(element => ({ ...element, visible: false }))

    expect(pickAt([framed(tree())], { x: 15, y: 15 })?.element).toBe('a1')
    expect(pickAt([framed(hidden)], { x: 15, y: 15 })).toEqual({ ui: 'hud', element: 'root' })
  })

  /**
   * The cadenas is a row of the tree, not a property a subtree inherits: a locked panel is not
   * picked, and what it holds still is.
   */
  it('skips a locked element for an editor, and never for the runtime', () => {
    const locked = tree(element => ({ ...element, locked: true }))

    expect(pickAt([framed(locked)], { x: 35, y: 50 }, { skipLocked: true })?.element).toBe('root')
    expect(pickAt([framed(locked)], { x: 15, y: 15 }, { skipLocked: true })?.element).toBe('a1')
    expect(pickAt([framed(locked)], { x: 35, y: 50 })?.element).toBe('a')
  })

  /**
   * Nothing clips yet, so a child laid outside its parent is on screen and has to answer. Read
   * through the parent's box instead, it would be unreachable while plainly visible.
   */
  it('reaches a child that falls outside its parent', () => {
    const boxes: UiBoxes = new Map([
      ['root', { x: 0, y: 0, width: 100, height: 100 }],
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['a1', { x: 50, y: 50, width: 20, height: 20 }],
    ])

    expect(
      pickAt([framed(uiScreen([uiPanel('a', [uiPanel('a1')])]), 'hud', 0, boxes)], {
        x: 55,
        y: 55,
      }),
    ).toEqual({ ui: 'hud', element: 'a1' })
  })

  /** Half-open: the pixel two boxes share belongs to the one whose edge starts on it. */
  it('gives an edge to one box only', () => {
    const boxes: UiBoxes = new Map([
      ['root', { x: 0, y: 0, width: 100, height: 100 }],
      ['a', { x: 0, y: 0, width: 20, height: 100 }],
      ['b', { x: 20, y: 0, width: 20, height: 100 }],
    ])

    const frame = framed(uiScreen([uiPanel('a'), uiPanel('b')]), 'hud', 0, boxes)
    expect(pickAt([frame], { x: 19, y: 5 })?.element).toBe('a')
    expect(pickAt([frame], { x: 20, y: 5 })?.element).toBe('b')
  })
})
