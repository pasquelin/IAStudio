import type { CommandId } from '@shared/domain/command'
import { canRedo, canUndo } from '@/engines/core/history'
import { audioHistoryOf, useAudioEdits } from '@/stores/audioEdits'
import { useSequences } from '@/stores/sequences'

/**
 * The commands of a take, reached the same way from the tab and from a headless run. The
 * take's own history answers while it has anything to give back, the montage otherwise.
 */
export function runAudioCommand(documentId: string, command: CommandId): boolean {
  const takes = useAudioEdits.getState()
  const montage = useSequences.getState()

  if (command === 'audio.undo') {
    if (canUndo(audioHistoryOf(takes, documentId))) takes.undo(documentId)
    else montage.undo(documentId)
    return true
  }
  if (command === 'audio.redo') {
    if (canRedo(audioHistoryOf(takes, documentId))) takes.redo(documentId)
    else montage.redo(documentId)
    return true
  }
  return false
}
