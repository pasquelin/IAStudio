import type { SequenceState } from '@/engines/timeline/timelineState'
import { useSequences } from '@/stores/sequences'
import { useDocumentEdit, type DocumentEdit } from './useDocumentEdit'

export type SequenceEdit = DocumentEdit<SequenceState>

export function useSequenceEdit(documentId: string): SequenceEdit {
  return useDocumentEdit(useSequences, documentId)
}
