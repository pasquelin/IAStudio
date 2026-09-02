import type { CommandId } from '@shared/domain/command'
import { clamp } from '@shared/numeric'
import { removeClip, splitClip, unlinkClip } from '@/engines/timeline/commands'
import {
  clipById,
  clipUnderPlayhead,
  sequenceDuration,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import type { CommandAnswer } from '@/services/commandBus'
import { runHistoryCommand } from '@/services/historyCommand'
import { playbackHeadOf, usePlayback } from '@/stores/playback'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'

/**
 * A montage with the head one can actually see. `clockHead ?? playhead` is what every surface of
 * the strip draws, so it has to be what every gesture ACTS on — the split, the blade's own menu.
 */
export function shownSequence(documentId: string, sequence: SequenceState): SequenceState {
  const head = playbackHeadOf(usePlayback.getState(), documentId)

  return head === undefined ? sequence : { ...sequence, playhead: head }
}

/** Puts the head at an instant of the montage — the strip follows on its own. */
export function seekTo(documentId: string, time: number): void {
  const store = useSequences.getState()
  const state = sequenceOf(store, documentId)
  store.replace(documentId, { ...state, playhead: clamp(time, 0, sequenceDuration(state)) })
}

/**
 * The commands of a montage that read nothing but its stores, reached the same way from the strip
 * and from a headless run. The zoom and the exports stay with the strip: the one knows its width,
 * the others write files.
 */
export function runSequenceCommand(documentId: string, command: CommandId): CommandAnswer {
  const store = useSequences.getState()
  const shown = (): SequenceState => shownSequence(documentId, sequenceOf(store, documentId))

  switch (command) {
    case 'sequence.split': {
      const state = shown()
      const target = clipUnderPlayhead(state)
      if (!target) return false
      store.runCommand(documentId, splitClip(target.id, state.playhead))
      return true
    }
    case 'sequence.delete': {
      const { selectedId } = shown()
      if (!selectedId) return false
      store.runCommand(documentId, removeClip(selectedId))
      return true
    }
    case 'sequence.unlink': {
      // Asked here rather than left to the command: every command run lands on the undo stack,
      // so a ⌘L on a clip tied to nothing would mark the document modified for a ⌘Z that visibly
      // does nothing.
      const state = shown()
      const linked = state.selectedId ? clipById(state, state.selectedId) : null
      if (!linked?.linkId) return false
      store.runCommand(documentId, unlinkClip(linked.id))
      return true
    }
    case 'sequence.start':
      seekTo(documentId, 0)
      return true
    case 'sequence.end':
      seekTo(documentId, sequenceDuration(shown()))
      return true
    default:
      return runHistoryCommand(sequenceStore, 'sequence', documentId, command) ?? false
  }
}
