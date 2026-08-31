import i18next from 'i18next'
import { uiFromPayload, uiPayload } from '@shared/domain/uiDocument'
import type { UiDocument, UiTrouble } from '@shared/domain/ui'
import { newGui, type GuiState } from '@/engines/gui/guiState'
import { newId } from '@/helpers/ids'
import { reportNotice } from '@/services/diagnostics'

/**
 * An interface on its way to and from its file, which is one JSON object and nothing else.
 *
 * 🛑 A file the reader could not open does NOT come back as a blank screen: what it answered is
 * remembered here and refuses the next save, or a half-synced document would be one ⌘S away
 * from being blank for good. The two troubles are told apart on screen — one says « update the
 * studio », the other « repair this file ».
 */
const troubled = new Map<string, UiTrouble>()

export const forgetTroubledGui = (documentId: string): void => {
  troubled.delete(documentId)
}

export const guiRefusesToSave = (documentId: string): string | null => {
  const trouble = troubled.get(documentId)
  if (!trouble) return null

  return trouble === 'too-new'
    ? i18next.t('documents.saveRefusedGuiTooNew')
    : i18next.t('documents.saveRefusedGuiUnreadable')
}

export const guiPayload = (state: GuiState): UiDocument => uiPayload(state.document)

export function guiFromPayload(payload: unknown, documentId: string): GuiState {
  const read = uiFromPayload(payload, newId)
  troubled.delete(documentId)

  if (read.trouble) {
    troubled.set(documentId, read.trouble)
    reportNotice(
      'document.load',
      i18next.t(read.trouble === 'too-new' ? 'documents.guiTooNew' : 'documents.guiUnreadable'),
    )
  }

  return { document: read.document, selectedIds: [] }
}

export const createDefaultGui = (): GuiState => newGui()
