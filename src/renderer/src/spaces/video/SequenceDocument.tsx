import { mdiVideoOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { ResizeHandle } from '@/design/ResizeHandle'
import { programOwner } from '@/engines/timeline/playback'
import {
  EMPTY_SEQUENCE,
  makeTrack,
  trackOfClip,
  type SequenceState,
  type Us,
} from '@/engines/timeline/timeline-state'
import { useDocuments } from '@/stores/documents'
import { fitSplit } from '@/stores/tools'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { Monitor } from './Monitor'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'

export type SequenceDocumentProps = { documentId: string }

/**
 * Two monitors, Premiere and DaVinci convention: source on the left, program on the right. The
 * montage itself is the `timeline` tool window — a strip the width of the app, not a corner of
 * this tab.
 */
export function SequenceDocument({ documentId }: SequenceDocumentProps) {
  const { t } = useTranslation()
  const sequence = useSequences(state => sequenceOf(state, documentId))
  const [sourceTime, setSourceTime] = useState<Us>(0)
  // Dockview keeps hidden tabs mounted: without this every open sequence would answer the
  // space bar at once, and the playback token would arbitrate a fight nobody started.
  const active = useDocuments(state => state.activeId === documentId)

  useRestoredDocument(documentId)

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

  // Found through its track, not by id alone: the montage's own answer to "is this a sound?" is
  // the track the clip sits on, and the inspector and the program monitor both read it there.
  const holder = sequence.selectedId ? trackOfClip(sequence, sequence.selectedId) : null
  const selected = holder?.clips.find(clip => clip.id === sequence.selectedId) ?? null

  // The source monitor plays one clip, which is a sequence of one — same engine, same painter.
  const source: SequenceState = useMemo(
    () => ({
      ...EMPTY_SEQUENCE,
      settings: sequence.settings,
      playhead: sourceTime,
      tracks:
        holder && selected
          ? [
              makeTrack({
                id: 'S1',
                // Mounted on a picture track, a take is shown as a black frame and heard as
                // nothing at all: `audioChunksIn` only schedules tracks of the sound kind.
                kind: holder.kind,
                index: 1,
                locked: true,
                clips: [{ ...selected, start: 0 }],
              }),
            ]
          : [],
    }),
    [holder, selected, sequence.settings, sourceTime],
  )

  const setProgramTime = useCallback(
    (playhead: Us) => {
      const store = useSequences.getState()
      // Playback is not an edit: the playhead goes through `replace`, which skips the history.
      store.replace(documentId, { ...sequenceOf(store, documentId), playhead })
    },
    [documentId],
  )

  return (
    <div ref={rowRef} className="flex h-full min-h-0">
      {/* Fixed width once it has been dragged, an equal share until then: a document opens on two
          monitors of the same size, and only a gesture makes one of them the wide one. */}
      <div
        className="flex min-w-0"
        style={sourceWidth === null ? { flex: 1 } : { width: sourceWidth, flexShrink: 0 }}
      >
        <Monitor
          owner={`${documentId}:source`}
          title={t('transport.source')}
          role={t('transport.sourceRole')}
          sequence={source}
          onTime={setSourceTime}
          placeholder={
            selected ? null : <EmptyState icon={mdiVideoOutline} message={t('transport.noClip')} />
          }
        />
      </div>

      {/* The same handle the shell splits its zones with, so the gesture is the one gesture. It
          replaces a `Separator`, which drew the line and refused to be moved. */}
      <ResizeHandle
        axis="horizontal"
        size={sourceWidth ?? available / 2}
        onSize={(size, room) => setSourceWidth(fitSplit(size, room))}
      />

      <div className="flex min-w-0 flex-1">
        <Monitor
          owner={programOwner(documentId)}
          title={t('transport.program')}
          role={t('transport.programRole')}
          sequence={sequence}
          onTime={setProgramTime}
          keyboard={active}
        />
      </div>
    </div>
  )
}
