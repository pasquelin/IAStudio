import { newUiDocument } from '@shared/domain/uiDocument'
import type { UiDocument } from '@shared/domain/ui'
import { newId } from '@/helpers/ids'

/**
 * An interface as the studio edits it: what the file holds, plus what is designated.
 *
 * The selection sits in the state and is left OUT of the payload — the same split a scene
 * keeps: it belongs to a session, and writing it would make a document dirty for a click.
 */
export type GuiState = {
  document: UiDocument
  selectedIds: readonly string[]
}

export const newGui = (): GuiState => ({ document: newUiDocument(newId), selectedIds: [] })

export const EMPTY_GUI: GuiState = newGui()
