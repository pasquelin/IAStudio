import { beforeEach, describe, expect, it } from 'vitest'
import { uiPanel, uiScreen } from '@game/ui/ui-fixtures'
import { renameUiElement } from '@/engines/gui/guiCommands'
import { newGui } from '@/engines/gui/guiState'
import { guiHistoryOf, guiOf, guiStore, selectInGui, useGuis } from './gui'

const DOCUMENT = 'gui-1'

const entries = (): number => guiHistoryOf(useGuis.getState(), DOCUMENT).past.length

beforeEach(() => {
  guiStore.resetForTests()
  useGuis.getState().replace(DOCUMENT, {
    ...newGui(),
    document: { ...newGui().document, root: uiScreen([uiPanel('a'), uiPanel('b')]) },
  })
})

describe('the interface a document holds', () => {
  /** 🛑 A click is not an edit: a ⌘Z per row before undoing anything is what this prevents. */
  it('writes a selection without an entry in the history', () => {
    selectInGui(DOCUMENT, ['a'])

    expect(guiOf(useGuis.getState(), DOCUMENT).selectedIds).toEqual(['a'])
    expect(entries()).toBe(0)
  })

  it('adds to the selection when asked to toggle, and replaces otherwise', () => {
    selectInGui(DOCUMENT, ['a'])
    selectInGui(DOCUMENT, ['b'], 'toggle')
    expect(guiOf(useGuis.getState(), DOCUMENT).selectedIds).toEqual(['a', 'b'])

    selectInGui(DOCUMENT, ['b'])
    expect(guiOf(useGuis.getState(), DOCUMENT).selectedIds).toEqual(['b'])
  })

  it('leaves the state untouched when the same rows are picked again', () => {
    selectInGui(DOCUMENT, ['a'])
    const held = guiOf(useGuis.getState(), DOCUMENT)
    selectInGui(DOCUMENT, ['a'])

    expect(guiOf(useGuis.getState(), DOCUMENT)).toBe(held)
  })

  it('takes an edit back through the history it keeps', () => {
    useGuis.getState().runCommand(DOCUMENT, renameUiElement('a', 'Health'))
    expect(entries()).toBe(1)

    useGuis.getState().undo(DOCUMENT)
    expect(guiOf(useGuis.getState(), DOCUMENT).document.root.children[0]?.name).toBe('')
  })
})
