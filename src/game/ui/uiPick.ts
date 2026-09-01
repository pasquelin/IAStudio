// SPDX-License-Identifier: MIT

import type { UiBox, UiBoxes, UiElement, UiPoint } from '@shared/domain/ui'
import type { UiFrame, UiHit } from '../ports/uiRenderPort'
import { childrenOf } from './uiTree'

export type UiPickOptions = {
  /** Editing only — the runtime has no such notion, so it never asks for this. */
  skipLocked?: boolean
}

/**
 * What a point landed on, read from the boxes and from nothing else.
 *
 * 🛑 One implementation for every surface: a world-space renderer turns its ray into a `UiPoint`
 * and asks this, rather than growing a second hit-test that drifts.
 *
 * A child is tested even when it falls OUTSIDE its parent's box — nothing clips yet — and a
 * locked element does not lock its subtree: the cadenas is a row of the tree, not an inheritance.
 */
export function pickAt(
  frames: readonly UiFrame[],
  point: UiPoint,
  options: UiPickOptions = {},
): UiHit | null {
  // Topmost first, which is the reverse of the paint order.
  for (const frame of piled(frames, 'down')) {
    const found = hitIn(frame.document.root, frame.boxes, point, options.skipLocked === true)
    if (found !== null) return { ui: frame.ui, element: found }
  }

  return null
}

/**
 * The pile, and it is `order` that says it — never the order the frames were handed over in.
 *
 * One implementation for both halves: what paints last is what a point hits first, so a renderer
 * sorting on its own would eventually disagree with the pick about which interface is on top.
 */
export function piled(frames: readonly UiFrame[], way: 'up' | 'down' = 'up'): readonly UiFrame[] {
  // One frame is the ordinary case in an editor, and it needs neither copy nor sort.
  if (frames.length < 2) return frames

  return [...frames].sort((one, other) =>
    way === 'up' ? one.order - other.order : other.order - one.order,
  )
}

function hitIn(
  element: UiElement,
  boxes: UiBoxes,
  point: UiPoint,
  skipLocked: boolean,
): string | null {
  if (!element.visible) return null

  const children = childrenOf(element)
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index]
    if (!child) continue

    const found = hitIn(child, boxes, point, skipLocked)
    if (found !== null) return found
  }

  if (skipLocked && element.locked) return null

  const box = boxes.get(element.id)
  return box && covers(box, point) ? element.id : null
}

/** Half-open, so two boxes sharing an edge do not both claim the pixel on it. */
function covers(box: UiBox, point: UiPoint): boolean {
  return (
    point.x >= box.x &&
    point.x < box.x + box.width &&
    point.y >= box.y &&
    point.y < box.y + box.height
  )
}
