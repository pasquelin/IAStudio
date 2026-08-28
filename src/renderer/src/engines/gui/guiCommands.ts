import { holdsChildren, type UiElement, type UiScreen, type UiSize } from '@shared/domain/ui'
import { newUiElement } from '@shared/domain/uiDocument'
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
} from '@game/ui/uiTree'
import { applySelection, type SelectionMode } from '@/helpers/selection'
import { commandId, composed, type Command } from '../core/history'
import type { GuiState } from './guiState'

/**
 * What editing an interface does to it. Every one is a `Command<GuiState>`, so the window, a
 * shortcut and the MCP reach the document through one door and one ⌘Z takes any of them back.
 *
 * 🛑 What a command needs to REVERT is captured as it is applied — redo replays it — but what it
 * needs to IDENTIFY is frozen when it is built: an id minted inside `apply` would differ between
 * the first run and the redo, and any later command naming it would go inert.
 */
export function addUiElement(
  parentId: string,
  element: UiElement,
  index?: number,
): Command<GuiState> {
  return {
    id: commandId('ui.add', [element.id]),
    apply: state => ({
      ...withRoot(state, withElement(state.document.root, parentId, element, index)),
      selectedIds: [element.id],
    }),
    revert: state => withRoot(state, withoutElement(state.document.root, element.id)),
    refuses: state => !canHoldUi(state.document.root, element.id, parentId),
  }
}

export function removeUiElements(ids: readonly string[]): Command<GuiState> {
  /** Where each one hung, captured on the way out so redo puts it back where it was. */
  let taken: { element: UiElement; parentId: string; index: number }[] = []

  return {
    id: commandId('ui.remove', ids),
    apply: state => {
      taken = []
      let root = state.document.root
      for (const id of ids) {
        const element = elementById(root, id)
        const parent = parentOf(root, id)
        if (!element || !parent) continue

        taken.push({ element, parentId: parent.id, index: indexIn(parent, id) })
        root = withoutElement(root, id)
      }

      return withRoot(state, root)
    },
    revert: state => {
      let root = state.document.root
      // Backwards: an element taken out second was indexed against a level the first had left.
      for (const one of [...taken].reverse()) {
        root = withElement(root, one.parentId, one.element, one.index)
      }
      return withRoot(state, root)
    },
    refuses: refusesEvery(ids),
  }
}

/**
 * One element hung from another, at a place in it — capturing where it CAME FROM rather than
 * photographing the tree, which is what lets two of these coalesce into one drag later on.
 */
export function reparentUiElement(id: string, parentId: string, index?: number): Command<GuiState> {
  let from: { parentId: string; index: number } | null = null

  return {
    id: commandId('ui.reparent', [id]),
    apply: state => {
      const parent = parentOf(state.document.root, id)
      from = parent ? { parentId: parent.id, index: indexIn(parent, id) } : null
      return withRoot(state, reparented(state.document.root, id, parentId, index))
    },
    revert: state =>
      from
        ? withRoot(state, reparented(state.document.root, id, from.parentId, from.index))
        : state,
    refuses: state => !canHoldUi(state.document.root, id, parentId),
  }
}

/**
 * A batch hung from another element. ONE entry in the history for all of them — six rows filed
 * into a panel cost one ⌘Z, which is why anyone selects six.
 */
export function reparentUiElements(
  ids: readonly string[],
  parentId: string,
  index?: number,
): Command<GuiState> {
  return composed(
    commandId('ui.reparent', ids),
    ids.map((id, rank) =>
      reparentUiElement(id, parentId, index === undefined ? undefined : index + rank),
    ),
  )
}

/** Whether an element may be hung from another — never from itself, never from its own subtree. */
export function canHoldUi(root: UiScreen, id: string, parentId: string): boolean {
  const parent = elementById(root, parentId)
  if (!parent || !holdsChildren(parent.type)) return false

  return id !== parentId && !contains(root, id, parentId)
}

export function renameUiElement(id: string, name: string): Command<GuiState> {
  return editUiElement(commandId('ui.rename', [id]), id, element => ({ ...element, name }), {
    unchanged: element => element.name === name,
  })
}

/** What an element IS on screen and to the hand, each written the same way. */
export type UiFlag = 'visible' | 'enabled' | 'locked'

export function setUiFlag(id: string, flag: UiFlag, value: boolean): Command<GuiState> {
  return editUiElement(
    commandId(`ui.${flag}`, [id]),
    id,
    element => ({ ...element, [flag]: value }),
    { unchanged: element => element[flag] === value },
  )
}

/**
 * A flag written across a batch, in ONE entry. What the FIRST of them is not settles a mixed
 * selection — here rather than in whichever surface asked, so the toolbar, a shortcut and the
 * MCP all flip a batch the same way.
 */
export function setUiFlags(ids: readonly string[], flag: UiFlag): Command<GuiState> {
  let before: Map<string, boolean> = new Map()

  return {
    id: commandId(`ui.${flag}`, ids),
    apply: state => {
      before = new Map(ids.map(id => [id, elementById(state.document.root, id)?.[flag] === true]))
      // What the FIRST of them is NOT: a mixed batch has to settle on one answer.
      const wanted = before.get(ids[0] ?? '') !== true

      let root = state.document.root
      for (const id of ids) root = mapped(root, id, element => ({ ...element, [flag]: wanted }))
      return withRoot(state, root)
    },
    revert: state => {
      let root = state.document.root
      for (const [id, worn] of before) root = mapped(root, id, one => ({ ...one, [flag]: worn }))
      return withRoot(state, root)
    },
    refuses: state => ids.every(id => !holds(state, id)),
  }
}

/**
 * Copies of what is selected, laid beside their originals and selected in their place.
 *
 * Fresh ids all the way down, minted ONCE: two elements sharing one id would give the layout and
 * the picking two answers, and ids minted inside `apply` would differ on a redo.
 */
export function duplicateUiElements(
  ids: readonly string[],
  newId: () => string,
): Command<GuiState> {
  /**
   * Source id → copy id, filled on the first apply and REUSED by a redo. Minted again, the whole
   * subtree would come back under other ids and any later command naming one would go inert.
   */
  const minted = new Map<string, string>()
  const idFor = (source: string): string => {
    const held = minted.get(source)
    if (held !== undefined) return held

    const made = newId()
    minted.set(source, made)
    return made
  }

  return {
    id: commandId('ui.duplicate', ids),
    apply: state => {
      let root = state.document.root
      const made: string[] = []
      for (const id of rootsOf(state.document.root, ids)) {
        const element = elementById(root, id)
        const parent = parentOf(root, id)
        if (!element || !parent) continue

        const copy = renumbered(element, idFor)
        made.push(copy.id)
        root = withElement(root, parent.id, copy, indexIn(parent, id) + 1)
      }

      return { ...withRoot(state, root), selectedIds: made }
    },
    revert: state => {
      let root = state.document.root
      for (const id of rootsOf(state.document.root, ids)) {
        const copy = minted.get(id)
        if (copy !== undefined) root = withoutElement(root, copy)
      }
      return withRoot(state, root)
    },
    refuses: refusesEvery(ids),
  }
}

/**
 * 🛑 The ones NOT already inside another of the batch. A parent and its own child both copied
 * would mint the child's id twice — once inside the parent's subtree, once on its own — and two
 * elements under one id give the layout and the picking two answers to the same question.
 */
const rootsOf = (root: UiScreen, ids: readonly string[]): readonly string[] =>
  ids.filter(id => !ids.some(other => other !== id && contains(root, other, id)))

/**
 * A panel laid where the FIRST of the batch stands in the TREE — grouping six rows must not
 * shuffle them — holding all of them. Only siblings: elements from two levels put under one
 * parent would be moved as well as grouped, and no gesture asked for that.
 */
export function groupUiElements(ids: readonly string[], newId: () => string): Command<GuiState> {
  const group: UiElement = { ...newUiElement('panel', newId), name: '' }

  return {
    id: commandId('ui.group', [group.id]),
    apply: state => {
      const parent = parentOf(state.document.root, ids[0] ?? '')
      const ordered = parent ? childrenOf(parent).filter(child => ids.includes(child.id)) : []
      const opening = ordered[0]
      if (!parent || !opening) return state

      let root = withElement(state.document.root, parent.id, group, indexIn(parent, opening.id))
      for (const child of ordered) root = reparented(root, child.id, group.id)

      return { ...withRoot(state, root), selectedIds: [group.id] }
    },
    revert: state => {
      // The panel out, its children back where the tree already holds them: the group was laid
      // at the first one's place, so removing it drops them at that level in their own order.
      let root = state.document.root
      const held = elementById(root, group.id)
      const parent = parentOf(root, group.id)
      if (!held || !parent) return state

      const at = indexIn(parent, group.id)
      for (const [rank, child] of childrenOf(held).entries()) {
        root = reparented(root, child.id, parent.id, at + rank)
      }
      return withRoot(state, withoutElement(root, group.id))
    },
    refuses: state => !sameParent(state.document.root, ids),
  }
}

/**
 * The canvas the author draws at. An edit of the DOCUMENT, not of the view: anchors absorb a
 * screen of another shape, so this says what the interface was composed FOR.
 */
export function setUiDesign(design: UiSize): Command<GuiState> {
  let before: UiSize | null = null

  return {
    id: 'ui.design',
    apply: state => {
      before = state.document.design
      return { ...state, document: { ...state.document, design } }
    },
    revert: state =>
      before ? { ...state, document: { ...state.document, design: before } } : state,
    refuses: state =>
      state.document.design.width === design.width &&
      state.document.design.height === design.height,
  }
}

/** The selection, which is a session's business and stays out of the history. */
export function setUiSelection(
  state: GuiState,
  ids: readonly string[],
  mode: SelectionMode = 'replace',
): GuiState {
  return { ...state, selectedIds: applySelection(state.selectedIds, ids, mode) }
}

function editUiElement(
  id: string,
  elementId: string,
  change: (element: UiElement) => UiElement,
  refusal: { unchanged: (element: UiElement) => boolean },
): Command<GuiState> {
  let before: UiElement | null = null

  return {
    id,
    apply: state => {
      before = elementById(state.document.root, elementId)
      return withRoot(state, mapped(state.document.root, elementId, change))
    },
    revert: state => {
      const held = before
      return held
        ? withRoot(
            state,
            mapped(state.document.root, elementId, () => held),
          )
        : state
    },
    // 🛑 An edit writing what the element already carries costs a ⌘Z that moves nothing.
    refuses: state => {
      const element = elementById(state.document.root, elementId)
      return !element || refusal.unchanged(element)
    },
  }
}

/**
 * 🛑 The selection is purged HERE and nowhere else. An id the tree no longer holds leaves the
 * outliner and the inspector reading an element that is not there — and undoing a removal is
 * where that happens, not only removing.
 */
function withRoot(state: GuiState, root: UiScreen): GuiState {
  const document = { ...state.document, root }
  if (state.selectedIds.length === 0) return { ...state, document }

  const held = new Set(flattened(root).map(element => element.id))
  return { ...state, document, selectedIds: state.selectedIds.filter(id => held.has(id)) }
}

/** The screen IS the document: taking it away would leave a file nothing can open. */
const refusesEvery =
  (ids: readonly string[]) =>
  (state: GuiState): boolean =>
    ids.every(id => id === state.document.root.id || !holds(state, id))

const holds = (state: GuiState, id: string): boolean =>
  elementById(state.document.root, id) !== null

const indexIn = (parent: UiElement, id: string): number =>
  childrenOf(parent).findIndex(child => child.id === id)

function sameParent(root: UiScreen, ids: readonly string[]): boolean {
  const opening = ids[0]
  if (opening === undefined) return false

  const first = parentOf(root, opening)
  return first !== null && ids.every(id => parentOf(root, id)?.id === first.id)
}

function renumbered(element: UiElement, idFor: (source: string) => string): UiElement {
  const copy = { ...element, id: idFor(element.id) }
  return 'children' in copy
    ? { ...copy, children: copy.children.map(child => renumbered(child, idFor)) }
    : copy
}
