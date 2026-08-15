import { useCallback } from 'react'
import type { CommandId } from '@shared/domain/command'
import { ResizeHandle } from '@/design/ResizeHandle'
import { canRedo, canUndo } from '@/engines/core/history'
import type { Us } from '@/engines/timeline/timeline-state'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useSplitPair } from '@/hooks/useSplitPair'
import { audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
import { ProgramMonitor } from './ProgramMonitor'
import { TakeEditor } from './TakeEditor'
import { useSoundTransport } from './useSoundTransport'

export type AudioDocumentProps = { documentId: string }

/**
 * Two monitors, stacked: the montage above, the take being edited below. The montage itself is
 * the `timeline` tool window — a strip the width of the app, not a corner of this tab.
 *
 * The pair is what the space was missing. An editor alone showed one take while the strip below
 * showed several, and nothing on screen said how the two were related — the centre simply did
 * not resemble the state of the timeline.
 */
export function AudioDocument({ documentId }: AudioDocumentProps) {
  const sequence = useSequences(state => sequenceOf(state, documentId))
  // Dockview keeps hidden tabs mounted: without this every open take would answer the space bar
  // at once, and the playback token would arbitrate a fight nobody started.
  const active = useDocuments(state => state.activeId === documentId)

  useRestoredDocument(documentId)

  /**
   * The player of the montage, owned by the monitor that shows it — as the picture pair does.
   *
   * It used to hang off the strip's title bar, for a reason this tab has just taken away: the
   * workspace had no monitor to hold one. The strip now reads it from the registry instead.
   */
  const transport = useSoundTransport(documentId, sequence)

  const { pairRef, leadStyle, dividerSize, onDividerSize } = useSplitPair('vertical')

  const seek = useCallback(
    (playhead: Us) => {
      const store = useSequences.getState()
      // Closing a tab drops the document BEFORE React unmounts this tab, and writing then would
      // build the montage back out of the store's default: a picture track, in a space that has
      // nothing to show one on. `SequenceDocument` carries the same line, for the same reason.
      if (!sequenceStore.hasState(store, documentId)) return

      // Scrubbing is not an edit: the head goes through `replace`, which skips the history.
      store.replace(documentId, { ...sequenceOf(store, documentId), playhead })
    },
    [documentId],
  )

  /**
   * ⌘Z, for a document holding TWO stories: the chain over the take, and the sound montage under
   * it. One key, one document, so it has to choose — and it chooses the chain whenever the chain
   * has anything to give back, the montage otherwise.
   *
   * The montage cannot answer for itself: its own scope is `sequence`, and a second listener on
   * that scope would undo BOTH halves on one press — the studio's "two diverging undo stacks",
   * which is why `SoundPanel` mounts the strip with its shortcuts off.
   */
  const onCommand = useCallback(
    (command: CommandId) => {
      const takes = useAudioEdits.getState()
      const montage = useSequences.getState()

      if (command === 'audio.undo') {
        return canUndo(audioHistoryOf(takes, documentId))
          ? takes.undo(documentId)
          : montage.undo(documentId)
      }
      if (command === 'audio.redo') {
        return canRedo(audioHistoryOf(takes, documentId))
          ? takes.redo(documentId)
          : montage.redo(documentId)
      }
    },
    [documentId],
  )

  // Both the keyboard and the Edit menu land here. `enabled` for the same reason the scene
  // gives: Dockview keeps hidden tabs mounted, and a background take would eat ⌘Z.
  useShortcuts({ scope: 'audio', enabled: active, onCommand })

  // The space bar, which the programme monitor answers here as it does in the picture pair.
  const onTransport = useCallback(
    (command: CommandId) => {
      if (command === 'sequence.playPause') transport.toggle()
    },
    [transport],
  )
  useShortcuts({ scope: 'sequence', enabled: active, onCommand: onTransport })

  return (
    /*
     * Stacked, where the picture pair sits side by side — and the difference is the thing being
     * looked at. A frame is judged at the largest size the tab can give it, so two of them share
     * the width; a waveform is READ along time, and half a width is half the montage's detail for
     * height nothing does anything with. Both keep the full width here, one above the other.
     *
     * The inset belongs to the COLUMN, not to each monitor: carried by both, it doubled around
     * the handle and the pair read as two panes pushed apart rather than two panels stacked.
     */
    <div ref={pairRef} className="flex h-full min-h-0 flex-col p-(--sc-gutter)">
      {/* The whole above the part, and the part above the strip it sits on: what one is making
          reads top to bottom, and the take being worked on stays next to the montage it lands
          in rather than a monitor's width away from it. */}
      <div className="flex min-h-0" style={leadStyle}>
        <ProgramMonitor sequence={sequence} transport={transport} onSeek={seek} />
      </div>

      {/* The same handle the shell splits its zones with, so the gesture is the one gesture. */}
      <ResizeHandle axis="vertical" size={dividerSize} onSize={onDividerSize} />

      <div className="flex min-h-0 flex-1">
        <TakeEditor documentId={documentId} />
      </div>
    </div>
  )
}
