// SPDX-License-Identifier: MIT

import type { UiElement, UiScreen } from '@shared/domain/ui'

/**
 * Walking an interface, and rebuilding it around one change.
 *
 * A nested tree rather than the flat list a scene keeps, and the trade is deliberate: a
 * `.ui.json` is meant to be read by eye and diffed in a commit, which nesting gives and
 * `parentId` does not. The price is these functions, written once.
 *
 * Every one of them REBUILDS: nothing here mutates, so a command can hold the tree it replaced
 * and hand it back on undo without having copied anything.
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

/** The root, then every element down to this one — what a layout and a pick both walk. */
export function pathTo(root: UiElement, id: string): readonly UiElement[] {
  if (root.id === id) return [root]

  for (const child of childrenOf(root)) {
    const below = pathTo(child, id)
    if (below.length > 0) return [root, ...below]
  }
  return []
}

/** Depth first, parents before children — the order a renderer paints in. */
export function flattened(root: UiElement): readonly UiElement[] {
  return [root, ...childrenOf(root).flatMap(flattened)]
}

/**
 * Every element with the id of the one holding it — `null` for the root.
 *
 * One descent rather than a `parentOf` per element: `parentOf` re-walks the whole tree, so the
 * pair costs O(n²) on a list an outliner rebuilds after every edit.
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
 * nothing. One walk serves insert, remove and edit alike, which is what keeps their three
 * behaviours from drifting.
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
 * One element moved under another, at a given index.
 *
 * 🛑 **The index counts positions in the tree as it stands NOW**, which is the gap the pointer
 * is over — so a drop is expressed by what the person sees. Moving a row down inside its own
 * parent is where that matters: the element leaves before it lands, and the index is decremented
 * to answer for it. Reading the index post-removal instead lands every such drag one short.
 *
 * Refused where the target sits inside what is moving: a parent dropped into its own child
 * would take the whole subtree out of the document, and nothing on screen would say so.
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
