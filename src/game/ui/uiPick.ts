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
 * 🛑 One implementation for every surface. A DOM overlay and a world-space texture differ in how
 * they turn a gesture into a `UiPoint`; once they have one, the answer must be the same, and two
 * hit-tests written a month apart are two answers that drift.
 *
 * The pile first — the last opened is on top — then, inside an interface, the order a renderer
 * paints in: a child covers its parent, and a later sibling covers an earlier one.
 *
 * A child is tested even when it falls OUTSIDE its parent's box: nothing clips yet, so what is
 * on screen is what answers. An invisible element hides its children with it; a locked one does
 * not — the cadenas is a row of the tree, not a property a subtree inherits.
 */
export function pickAt(
  frames: readonly UiFrame[],
  point: UiPoint,
  options: UiPickOptions = {},
): UiHit | null {
  const piled = [...frames].sort((one, other) => one.order - other.order)

  for (let index = piled.length - 1; index >= 0; index -= 1) {
    const frame = piled[index]
    if (!frame) continue

    const found = hitIn(frame.document.root, frame.boxes, point, options.skipLocked === true)
    if (found !== null) return { ui: frame.ui, element: found }
  }

  return null
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
