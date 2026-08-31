import { holdsChildren, isUiElementType } from '@shared/domain/ui'
import { newUiElement } from '@shared/domain/uiDocument'
import { elementById, parentOf } from '@game/ui/uiTree'
import type { Command } from '@/engines/core/history'
import type { GuiState } from '@/engines/gui/guiState'
import {
  addUiElement,
  duplicateUiElements,
  groupUiElements,
  removeUiElements,
  setUiFlags,
} from '@/engines/gui/guiCommands'
import { newId } from '@/helpers/ids'
import { guiOf, useGuis } from '@/stores/gui'

/**
 * What the studio does to an interface, whichever surface asked — the toolbar, the outliner, and
 * from the MCP lot on, the assistant.
 *
 * Apart from the space's dispatch for the reason `features/scene/components/sceneCommands.ts` gives: written
 * twice, a duplicate that stopped offsetting its copies would be fixed on one door and left
 * broken on the other. The policies live here rather than in a `.tsx` no other door can reach.
 */
const run = (documentId: string, command: Command<GuiState>): void =>
  useGuis.getState().runCommand(documentId, command)

const selectedIn = (documentId: string): readonly string[] =>
  guiOf(useGuis.getState(), documentId).selectedIds

/** Where an added element hangs: inside what is selected when it holds children, beside it if not. */
function addTargetIn(documentId: string): string {
  const state = guiOf(useGuis.getState(), documentId)
  const picked = state.selectedIds.at(-1)
  const element = picked ? elementById(state.document.root, picked) : null
  if (!element) return state.document.root.id

  return holdsChildren(element.type)
    ? element.id
    : (parentOf(state.document.root, element.id)?.id ?? state.document.root.id)
}

/** The type arrives as the toolbar's mode id, so it is narrowed at this door and nowhere later. */
export function addUiElementOfType(documentId: string, type: string): void {
  if (!isUiElementType(type)) return

  run(documentId, addUiElement(addTargetIn(documentId), newUiElement(type, newId)))
}

export const duplicateSelectedUi = (documentId: string): void =>
  run(documentId, duplicateUiElements(selectedIn(documentId), newId))

export const groupSelectedUi = (documentId: string): void =>
  run(documentId, groupUiElements(selectedIn(documentId), newId))

export const removeSelectedUi = (documentId: string): void =>
  run(documentId, removeUiElements(selectedIn(documentId)))

export const lockSelectedUi = (documentId: string): void =>
  run(documentId, setUiFlags(selectedIn(documentId), 'locked'))
