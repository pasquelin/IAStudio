import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Viewport } from '@/engines/timeline/timelineGeometry'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timelineView'
import { TimelineHeaderColumn } from '../../Timeline/TimelineHeaderColumn'
import { TrackHeadersRow } from './TrackHeadersRow'

export type TrackHeadersProps = { documentId: string }

/**
 * The column standing beside the canvas: one row per track, aligned with the rows it names.
 *
 * DOM rather than canvas, unlike the strip itself. These are controls — a text field, three
 * toggles, a drag handle — and reimplementing focus, hit areas and accessible names inside a
 * canvas would be rebuilding the browser. The clips stay painted; only their labels are here.
 */
export function TrackHeaders({ documentId }: TrackHeadersProps) {
  const { t } = useTranslation()
  const sequence = useSequences(state => sequenceOf(state, documentId))
  const scrollTop = useTimelineView(state => viewportOf(state, documentId).scrollTop)

  // Read out of the store rather than subscribed to: the column asks for the whole viewport only
  // at the moment of a gesture, and a subscription would redraw every header on a zoom.
  const viewportNow = useCallback(
    () => viewportOf(useTimelineView.getState(), documentId),
    [documentId],
  )
  const setViewport = useCallback(
    (next: Viewport) => useTimelineView.getState().set(documentId, next),
    [documentId],
  )

  return (
    <TimelineHeaderColumn
      scrollTop={scrollTop}
      // The same name in the Video montage and the Audio one: they mount this very component,
      // and a sound montage is a montage — see `MontagePanel`.
      label={t('timeline.trackList')}
      viewportNow={viewportNow}
      setViewport={setViewport}
    >
      {sequence.tracks.map((track, row) => (
        <TrackHeadersRow
          key={track.id}
          documentId={documentId}
          sequence={sequence}
          track={track}
          canRise={row > 0}
          canFall={row < sequence.tracks.length - 1}
        />
      ))}
    </TimelineHeaderColumn>
  )
}
