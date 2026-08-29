// SPDX-License-Identifier: MIT

import type { UiElement, UiScreen } from '@shared/domain/ui'

/**
 * Walking an interface, and rebuilding it around one change. Nested rather than the flat list a
 * scene keeps: a `.ui.json` is read by eye and diffed in a commit, which `parentId` does not give.
 *
 * Every one of them REBUILDS, so a command hands back the tree it replaced without copying it.
 */
export function childrenOf(element: UiElement): readonly UiElement[] {
  return 'children' in element ? element.children : []
}

export function elementById(root: UiElement, id: string): UiElement | null {
  if (root.id === id) return root

  for (const child of childrenOf(root)) {
    const found = elementById(child, id)
    if (found) return found
  }
  return null
}

export function parentOf(root: UiElement, id: string): UiElement | null {
  for (const child of childrenOf(root)) {
    if (child.id === id) return root

    const found = parentOf(child, id)
    if (found) return found
  }
  return null
}

/** Depth first, parents before children — the order a renderer paints in. */
export function flattened(root: UiElement): readonly UiElement[] {
  return [root, ...childrenOf(root).flatMap(flattened)]
}

/**
 * Every element with the id of the one holding it — `null` for the root. One descent: `parentOf`
 * re-walks the whole tree, so calling it per element costs O(n²) on every outliner rebuild.
 */
export function flattenedWithParents(
  root: UiElement,
  parentId: string | null = null,
): readonly { element: UiElement; parentId: string | null }[] {
  return [
    { element: root, parentId },
    ...childrenOf(root).flatMap(child => flattenedWithParents(child, root.id)),
  ]
}

/** Whether `id` sits at or under `ancestorId` — what refuses a drop into one's own subtree. */
export function contains(root: UiElement, ancestorId: string, id: string): boolean {
  const ancestor = elementById(root, ancestorId)
  return ancestor !== null && elementById(ancestor, id) !== null
}

/**
 * The tree with one element replaced by what `change` makes of it, or dropped when it makes
 * nothing. One walk for insert, remove and edit alike, so the three cannot drift apart.
 */
export function mapped(
  root: UiScreen,
  id: string,
  change: (element: UiElement) => UiElement | null,
): UiScreen {
  const changed = mappedIn(root, id, change)
  // The root is a screen and stays one: a change that returned something else, or nothing, is
  // refused rather than leaving a document nothing can open.
  return changed?.type === 'screen' ? changed : root
}

function mappedIn(
  element: UiElement,
  id: string,
  change: (element: UiElement) => UiElement | null,
): UiElement | null {
  if (element.id === id) return change(element)
  if (!('children' in element)) return element

  const kept: UiElement[] = []
  let touched = false
  for (const child of element.children) {
    const next = mappedIn(child, id, change)
    if (next !== child) touched = true
    if (next) kept.push(next)
  }

  return touched ? { ...element, children: kept } : element
}

export function withoutElement(root: UiScreen, id: string): UiScreen {
  return mapped(root, id, () => null)
}

/**
 * `element` laid inside `parentId`, at `index` — appended past the end, and refused where the
 * parent holds no children at all.
 */
export function withElement(
  root: UiScreen,
  parentId: string,
  element: UiElement,
  index = Number.MAX_SAFE_INTEGER,
): UiScreen {
  return mapped(root, parentId, parent => {
    if (!('children' in parent)) return parent

    const children = [...parent.children]
    children.splice(Math.max(0, Math.min(index, children.length)), 0, element)
    return { ...parent, children }
  })
}

/**
 * 🛑 **The index counts positions in the tree as it stands NOW** — the gap the pointer is over.
 * Moving a row down inside its own parent is where that matters: the element leaves before it
 * lands, so the index is decremented, and reading it post-removal lands every such drag short.
 *
 * Refused where the target sits inside what is moving: that would take the subtree out for good.
 */
export function reparented(
  root: UiScreen,
  id: string,
  parentId: string,
  index = Number.MAX_SAFE_INTEGER,
): UiScreen {
  const moving = elementById(root, id)
  if (!moving || id === parentId || contains(root, id, parentId)) return root

  const target = elementById(root, parentId)
  if (!target || !('children' in target)) return root

  const inSameParent = parentOf(root, id)?.id === parentId
  const before = inSameParent ? target.children.findIndex(child => child.id === id) : -1
  const landing = before !== -1 && before < index ? index - 1 : index

  return withElement(withoutElement(root, id), parentId, moving, landing)
}
