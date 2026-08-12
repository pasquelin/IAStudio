import { mdiVideoOutline } from '@mdi/js'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { Separator } from '@/design/Separator'
import { programOwner } from '@/engines/timeline/playback'
import {
  EMPTY_SEQUENCE,
  makeTrack,
  trackOfClip,
  type SequenceState,
  type Us,
} from '@/engines/timeline/timeline-state'
import { useDocuments } from '@/stores/documents'
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
    <div className="flex h-full min-h-0">
      <Monitor
        owner={`${documentId}:source`}
        title={t('transport.source')}
        sequence={source}
        onTime={setSourceTime}
        placeholder={
          selected ? null : <EmptyState icon={mdiVideoOutline} message={t('transport.noClip')} />
        }
      />

      <Separator orientation="vertical" />

      <Monitor
        owner={programOwner(documentId)}
        title={t('transport.program')}
        sequence={sequence}
        onTime={setProgramTime}
        keyboard={active}
      />
    </div>
  )
}
