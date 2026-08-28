import { describe, expect, it } from 'vitest'
import { elementById, flattened, parentOf } from '@game/ui/uiTree'
import { uiPanel, uiScreen, uiText } from '@game/ui/ui-fixtures'
import type { UiScreen } from '@shared/domain/ui'
import type { Command } from '../core/history'
import {
  addUiElement,
  canHoldUi,
  duplicateUiElements,
  groupUiElements,
  removeUiElements,
  renameUiElement,
  reparentUiElements,
  setUiFlag,
  setUiFlags,
  setUiSelection,
} from './guiCommands'
import type { GuiState } from './guiState'

/**
 * root ─┬ a ─ a1
 *       ├ b
 *       └ c
 */
const tree = (): UiScreen => uiScreen([uiPanel('a', [uiText('a1')]), uiPanel('b'), uiPanel('c')])

const stateOf = (selectedIds: readonly string[] = []): GuiState => ({
  document: {
    version: 1,
    mode: 'screen',
    design: { width: 1920, height: 1080 },
    root: tree(),
    bindings: [],
  },
  selectedIds,
})

/** Applied, then reverted, so every case says both halves of what a command is. */
const ran = (state: GuiState, command: Command<GuiState>): [GuiState, GuiState] => {
  const after = command.apply(state)
  return [after, command.revert(after)]
}

const idsOf = (state: GuiState): string[] => flattened(state.document.root).map(one => one.id)

let counter = 0
const newId = (): string => `made-${(counter += 1)}`

describe('editing an interface', () => {
  it('hangs an element from a container and takes it back out', () => {
    const [after, back] = ran(stateOf(), addUiElement('a', uiText('fresh')))

    expect(parentOf(after.document.root, 'fresh')?.id).toBe('a')
    expect(after.selectedIds).toEqual(['fresh'])
    expect(elementById(back.document.root, 'fresh')).toBeNull()
  })

  it('refuses to hang an element off something that holds none', () => {
    expect(addUiElement('a1', uiText('fresh')).refuses?.(stateOf())).toBe(true)
    expect(addUiElement('a', uiText('fresh')).refuses?.(stateOf())).toBe(false)
  })

  /** Back where it was, not appended: re-adding at the end silently reorders the outliner. */
  it('puts a removed element back at the place it held', () => {
    const [after, back] = ran(stateOf(), removeUiElements(['b']))

    expect(idsOf(after)).toEqual(['root', 'a', 'a1', 'c'])
    expect(idsOf(back)).toEqual(['root', 'a', 'a1', 'b', 'c'])
  })

  it('refuses to remove the screen, which IS the document', () => {
    expect(removeUiElements(['root']).refuses?.(stateOf())).toBe(true)
  })

  /**
   * 🛑 An id the tree no longer holds leaves the outliner and the inspector reading an element
   * that is not there — and the subtree of a removal goes with it.
   */
  it('drops from the selection whatever the tree stopped holding', () => {
    const [after] = ran(stateOf(['a1', 'b']), removeUiElements(['a']))

    expect(after.selectedIds).toEqual(['b'])
  })

  it('hangs a batch from another element in one entry', () => {
    const [after, back] = ran(stateOf(), reparentUiElements(['b', 'c'], 'a'))

    expect(parentOf(after.document.root, 'b')?.id).toBe('a')
    expect(parentOf(after.document.root, 'c')?.id).toBe('a')
    expect(parentOf(back.document.root, 'b')?.id).toBe('root')
  })

  /** A parent dropped into its own child would take the subtree out of the document. */
  it('refuses to hang an element inside itself or inside its own subtree', () => {
    expect(canHoldUi(tree(), 'a', 'a1')).toBe(false)
    expect(canHoldUi(tree(), 'a', 'a')).toBe(false)
    expect(canHoldUi(tree(), 'b', 'a')).toBe(true)
    // A caption holds no children, whoever asks.
    expect(canHoldUi(tree(), 'b', 'a1')).toBe(false)
  })

  it('renames an element and gives its name back', () => {
    const [after, back] = ran(stateOf(), renameUiElement('b', 'Health'))

    expect(elementById(after.document.root, 'b')?.name).toBe('Health')
    expect(elementById(back.document.root, 'b')?.name).toBe('')
  })

  it('hides and locks an element, and puts each back', () => {
    const [hidden, shown] = ran(stateOf(), setUiFlag('b', 'visible', false))
    const [locked] = ran(stateOf(), setUiFlag('b', 'locked', true))

    expect(elementById(hidden.document.root, 'b')?.visible).toBe(false)
    expect(elementById(shown.document.root, 'b')?.visible).toBe(true)
    expect(elementById(locked.document.root, 'b')?.locked).toBe(true)
  })

  /** 🛑 An edit writing what is already there costs a ⌘Z the person watches do nothing. */
  it('refuses an edit that changes nothing', () => {
    expect(renameUiElement('b', '').refuses?.(stateOf())).toBe(true)
    expect(setUiFlag('b', 'visible', true).refuses?.(stateOf())).toBe(true)
    expect(setUiFlag('b', 'visible', false).refuses?.(stateOf())).toBe(false)
    expect(renameUiElement('nowhere', 'x').refuses?.(stateOf())).toBe(true)
  })

  /** 🛑 Two elements under one id would give the layout and the picking two answers. */
  it('copies a subtree beside itself, under ids nothing else holds', () => {
    const [after, back] = ran(stateOf(), duplicateUiElements(['a'], newId))

    const ids = idsOf(after)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(idsOf(stateOf()).length + 2)
    // Beside its original rather than at the end of the level.
    expect(after.document.root.children.map(one => one.id)[1]).toBe(after.selectedIds[0])
    expect(idsOf(back)).toEqual(idsOf(stateOf()))
  })

  it('puts a batch into a panel of its own, in the order the tree holds them', () => {
    const [after, back] = ran(stateOf(), groupUiElements(['c', 'b'], newId))

    const group = after.selectedIds[0] ?? ''
    expect(elementById(after.document.root, group)?.type).toBe('panel')
    expect(parentOf(after.document.root, 'b')?.id).toBe(group)
    // Where the first of them stood, and in the tree's order — not the caller's.
    expect(after.document.root.children.map(one => one.id)).toEqual(['a', group])
    expect(elementById(after.document.root, group)?.name).toBe('')
    expect(idsOf(back)).toEqual(idsOf(stateOf()))
  })

  it('refuses to group elements that are not siblings', () => {
    expect(groupUiElements(['a', 'a1'], newId).refuses?.(stateOf())).toBe(true)
    expect(groupUiElements([], newId).refuses?.(stateOf())).toBe(true)
    expect(groupUiElements(['b', 'c'], newId).refuses?.(stateOf())).toBe(false)
  })

  /**
   * 🛑 The ids are minted ONCE and reused by the redo: minted again, the whole subtree would come
   * back under other ids and any later command naming one would go inert.
   */
  it('gives a redone duplicate the same ids as the first time', () => {
    const command = duplicateUiElements(['a'], newId)
    const first = command.apply(stateOf())
    const again = command.apply(command.revert(first))

    expect(idsOf(again)).toEqual(idsOf(first))
  })

  it('flips a batch to what the first of it is not, and puts each one back as it was', () => {
    const mixed = stateOf()
    const locked = setUiFlag('b', 'locked', true).apply(mixed)
    const [after, back] = ran(locked, setUiFlags(['c', 'b'], 'locked'))

    // `c` is not locked, so the batch locks — `b`, already locked, goes with it.
    expect(elementById(after.document.root, 'c')?.locked).toBe(true)
    expect(elementById(after.document.root, 'b')?.locked).toBe(true)
    expect(elementById(back.document.root, 'c')?.locked).toBe(false)
    expect(elementById(back.document.root, 'b')?.locked).toBe(true)
  })

  it('designates elements without touching the document', () => {
    const before = stateOf(['b'])
    const after = setUiSelection(before, ['c'], 'toggle')

    expect(after.selectedIds).toEqual(['b', 'c'])
    expect(after.document).toBe(before.document)
  })
})
