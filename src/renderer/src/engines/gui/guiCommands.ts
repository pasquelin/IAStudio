import {
  DEFAULT_INTERACTION,
  DEFAULT_PLACEMENT,
  DEFAULT_STYLE,
  holdsChildren,
  type UiElement,
  type UiScreen,
  type UiSize,
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
} from '@game/ui/uiTree'
import { applySelection, type SelectionMode } from '@/helpers/selection'
import type { Command } from '../core/history'
import type { GuiState } from './guiState'

/**
 * What editing an interface does to it. Every one of them is a `Command<GuiState>`, so the
 * window, a shortcut and the MCP all reach the document through the same door and one ⌘Z takes
 * any of them back.
 *
 * A command captures what it needs to revert AS IT IS APPLIED — redo replays it, and a closure
 * holding what the tree looked like when the command was built would restore a stale one.
 */
export function addUiElement(
  parentId: string,
  element: UiElement,
  index?: number,
): Command<GuiState> {
  return {
    id: `ui.add:${element.id}`,
    apply: state => ({
      ...withRoot(state, withElement(state.document.root, parentId, element, index)),
      selectedIds: [element.id],
    }),
    revert: state => withRoot(state, withoutElement(state.document.root, element.id)),
    // The root is the screen: an element hung off nothing would leave the document holding it
    // nowhere, and nothing on screen would say where it went.
    refuses: state => {
      const parent = elementById(state.document.root, parentId)
      return !parent || !holdsChildren(parent.type)
    },
  }
}

export function removeUiElements(ids: readonly string[]): Command<GuiState> {
  /** Where each one hung, captured on the way out so redo puts it back where it was. */
  let taken: { element: UiElement; parentId: string; index: number }[] = []

  return {
    id: `ui.remove:${ids.join(',')}`,
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
    // The screen is the document: removing it would leave a file nothing can open.
    refuses: state => ids.every(id => id === state.document.root.id || !holds(state, id)),
  }
}

/**
 * Elements hung from another, at a place in it. One entry for the whole batch — six rows filed
 * into a panel cost one ⌘Z, which is why anyone selects six.
 */
export function reparentUiElements(
  ids: readonly string[],
  parentId: string,
  index?: number,
): Command<GuiState> {
  let before: UiScreen | null = null

  return {
    id: `ui.reparent:${ids.join(',')}`,
    apply: state => {
      before = state.document.root
      let root = state.document.root
      ids.forEach((id, rank) => {
        root = reparented(root, id, parentId, index === undefined ? undefined : index + rank)
      })
      return withRoot(state, root)
    },
    revert: state => (before ? withRoot(state, before) : state),
    refuses: state => ids.every(id => !canHoldUi(state.document.root, id, parentId)),
  }
}

/** Whether an element may be hung from another — never from itself, never from its own subtree. */
export function canHoldUi(root: UiScreen, id: string, parentId: string): boolean {
  const parent = elementById(root, parentId)
  if (!parent || !holdsChildren(parent.type)) return false

  return id !== parentId && !contains(root, id, parentId)
}

export function renameUiElement(id: string, name: string): Command<GuiState> {
  return editUiElement(`ui.rename:${id}`, id, element => ({ ...element, name }), {
    unchanged: element => element.name === name,
  })
}

/** What an element IS on screen and to the hand, each written the same way. */
export type UiFlag = 'visible' | 'enabled' | 'locked'

export function setUiFlag(id: string, flag: UiFlag, value: boolean): Command<GuiState> {
  return editUiElement(`ui.${flag}:${id}`, id, element => ({ ...element, [flag]: value }), {
    unchanged: element => element[flag] === value,
  })
}

/**
 * Copies of what is selected, laid beside their originals and selected in their place.
 *
 * Fresh ids all the way down: two elements sharing one id would give the layout and the picking
 * two answers to the same question, and a save would write a document nothing could read back.
 */
export function duplicateUiElements(
  ids: readonly string[],
  newId: () => string,
): Command<GuiState> {
  let made: string[] = []

  return {
    id: `ui.duplicate:${ids.join(',')}`,
    apply: state => {
      made = []
      let root = state.document.root
      for (const id of ids) {
        const element = elementById(root, id)
        const parent = parentOf(root, id)
        if (!element || !parent) continue

        const copy = renumbered(element, newId)
        made.push(copy.id)
        root = withElement(root, parent.id, copy, indexIn(parent, id) + 1)
      }

      return { ...withRoot(state, root), selectedIds: made }
    },
    revert: state => {
      let root = state.document.root
      for (const id of made) root = withoutElement(root, id)
      return withRoot(state, root)
    },
    refuses: state => ids.every(id => id === state.document.root.id || !holds(state, id)),
  }
}

/**
 * A panel laid where the FIRST of the batch stood, holding all of them in the order the tree
 * has them — grouping six rows must not shuffle them.
 *
 * Only siblings: elements from two levels put under one parent would be moved as well as
 * grouped, and no gesture asked for that.
 */
export function groupUiElements(ids: readonly string[], newId: () => string): Command<GuiState> {
  const group: UiElement = {
    id: newId(),
    type: 'panel',
    name: '',
    visible: true,
    enabled: true,
    locked: false,
    place: DEFAULT_PLACEMENT,
    style: DEFAULT_STYLE,
    interaction: DEFAULT_INTERACTION,
    children: [],
  }
  let before: UiScreen | null = null

  return {
    id: `ui.group:${group.id}`,
    apply: state => {
      before = state.document.root
      const parent = parentOf(state.document.root, ids[0] ?? '')
      const ordered = parent ? childrenOf(parent).filter(child => ids.includes(child.id)) : []
      const opening = ordered[0]
      if (!parent || !opening) return state

      // Where the FIRST of them stood in the tree, not the first the caller happened to name.
      let root = withElement(state.document.root, parent.id, group, indexIn(parent, opening.id))
      for (const child of ordered) root = reparented(root, child.id, group.id)

      return { ...withRoot(state, root), selectedIds: [group.id] }
    },
    revert: state => (before ? withRoot(state, before) : state),
    refuses: state => !sameParent(state.document.root, ids),
  }
}

/**
 * The canvas the author draws at. An edit of the DOCUMENT, not of the view: anchors absorb a
 * screen of another shape, so this says what the interface was composed FOR — and a ⌘Z has to
 * take it back like any other change.
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
  const held = new Set(flattened(root).map(element => element.id))

  return {
    ...state,
    document: { ...state.document, root },
    selectedIds: state.selectedIds.filter(id => held.has(id)),
  }
}

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

function renumbered(element: UiElement, newId: () => string): UiElement {
  const copy = { ...element, id: newId() }
  return 'children' in copy
    ? { ...copy, children: copy.children.map(child => renumbered(child, newId)) }
    : copy
}
