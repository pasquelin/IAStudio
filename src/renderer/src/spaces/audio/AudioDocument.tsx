import { useCallback, useEffect, useRef, useState } from 'react'
import type { CommandId } from '@shared/domain/command'
import { ResizeHandle } from '@/design/ResizeHandle'
import { canRedo, canUndo } from '@/engines/core/history'
import type { Us } from '@/engines/timeline/timeline-state'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import { audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
import { fitSplit } from '@/stores/tools'
import { ProgramMonitor } from './ProgramMonitor'
import { TakeEditor } from './TakeEditor'
import { useSoundTransport } from './useSoundTransport'

export type AudioDocumentProps = { documentId: string }

/**
 * Two monitors, on the picture pair's convention: the take being edited on the left, the montage
 * it lands in on the right. The montage itself is the `timeline` tool window — a strip the width
 * of the app, not a corner of this tab.
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

  const rowRef = useRef<HTMLDivElement>(null)
  /** Null until the divider is dragged: the two monitors share the row equally before that. */
  const [sourceWidth, setSourceWidth] = useState<number | null>(null)
  /** The row's own width, so the handle starts a drag from where the divider actually is. */
  const [available, setAvailable] = useState(0)

  // The row changes width without any drag — the window, a panel, the timeline being opened. A
  // width kept in pixels through that either overflows the row or leaves the program nothing, so
  // it is re-clamped the way the shell re-clamps its zones after a window resize.
  useEffect(() => {
    const row = rowRef.current
    if (!row) return

    const observer = new ResizeObserver(() => {
      setAvailable(row.clientWidth)
      setSourceWidth(current => (current === null ? null : fitSplit(current, row.clientWidth)))
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

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
    // The inset belongs to the ROW, not to each monitor: carried by both, it doubled around the
    // handle and the pair read as two panes pushed apart rather than two panels side by side.
    <div ref={rowRef} className="flex h-full min-h-0 p-(--sc-gutter)">
      <div
        className="flex min-w-0"
        style={sourceWidth === null ? { flex: 1 } : { width: sourceWidth, flexShrink: 0 }}
      >
        <TakeEditor documentId={documentId} />
      </div>

      {/* The same handle the shell splits its zones with, so the gesture is the one gesture. */}
      <ResizeHandle
        axis="horizontal"
        size={sourceWidth ?? available / 2}
        onSize={(size, room) => setSourceWidth(fitSplit(size, room))}
      />

      <div className="flex min-w-0 flex-1">
        <ProgramMonitor sequence={sequence} transport={transport} onSeek={seek} />
      </div>
    </div>
  )
}
