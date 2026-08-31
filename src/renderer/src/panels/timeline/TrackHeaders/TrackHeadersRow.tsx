import { mdiDotsHorizontal } from '@mdi/js'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useContextMenu } from '@/hooks/useContextMenu'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuButton } from '@/design/MenuButton'
import { ResizeHandle } from '@/design/ResizeHandle'
import { createFrameCoalesce } from '@/engines/core/frameCoalesce'
import { moveTrack } from '@/engines/timeline/commands'
import {
  clampTrackHeight,
  playsThrough,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timelineState'
import { clamp } from '@shared/numeric'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { isTyping } from '@/helpers/typing'
import { selectTrackIn, sequenceOf, useSequences, writeTrack } from '@/stores/sequences'
import { TimelineRow } from '../TimelineRow/TimelineRow'
import { TrackFlagButton } from '../TrackFlagButton'
import { TRACK_FLAGS } from '../trackFlags'
import { renderMenuRows } from '@/design/menuRows'
import { trackMenuRows } from '../TrackMenu/trackMenuRows'
import { TrackHeadersName } from './TrackHeadersName'

/**
 * Moves a track through the stack and answers how far it went — nothing at either end.
 *
 * The refusal is decided HERE rather than left to the command, for the reason `sequence.unlink`
 * gives a few files away: every command that runs lands on the undo stack, so a step that moves
 * nothing would still mark the document modified and leave a ⌘Z that visibly does nothing.
 */
function moveTrackBy(documentId: string, trackId: string, by: number): number {
  const store = useSequences.getState()
  const tracks = sequenceOf(store, documentId).tracks
  const from = tracks.findIndex(track => track.id === trackId)
  if (from === -1) return 0

  const to = clamp(from + by, 0, tracks.length - 1)
  if (to === from) return 0

  store.runCommand(documentId, moveTrack(trackId, to - from))
  return to - from
}

type TrackHeadersRowProps = {
  documentId: string
  sequence: SequenceState
  track: Track
  canRise: boolean
  canFall: boolean
}

export function TrackHeadersRow({
  documentId,
  sequence,
  track,
  canRise,
  canFall,
}: TrackHeadersRowProps) {
  const { t } = useTranslation()
  const menu = useContextMenu()
  const heightCoalesce = useRef(createFrameCoalesce())

  // A gesture cut short must not drop the height it ended on.
  useEffect(() => {
    const coalesce = heightCoalesce.current
    return () => coalesce.flush()
  }, [])

  // Renaming is an edit and goes through a command; the rest is state — see `writeTrack`.
  const write = (change: (current: Track) => Track): void =>
    writeTrack(documentId, track.id, change)

  const selected = sequence.selectedTrackId === track.id
  const audible = playsThrough(sequence, track)
  const rows = trackMenuRows(t, { documentId, trackId: track.id, canRise, canFall })

  return (
    <TimelineRow
      height={track.height}
      reorder={{
        label: t('timeline.reorderTrack', { name: track.name }),
        move: by => moveTrackBy(documentId, track.id, by),
        // A drag across three places is one thing the user did: without the gesture, `runCommand`
        // pushes an entry per step, and ⌘Z gives the stack back a row at a time.
        begin: () => useSequences.getState().beginGesture(documentId),
        end: () => useSequences.getState().endGesture(documentId),
      }}
      data-testid={`track-header-${track.id}`}
      // The one row the inspector is describing. Nothing else on this line says so: a click sends
      // the track to the inspector, which then talks about a row the column does not mark.
      // `true` rather than `page`, which is for navigation — this is a selection within a list.
      aria-current={selected ? 'true' : undefined}
      onPointerDown={() => selectTrackIn(documentId, track.id)}
      onContextMenu={event => {
        // A right-click in the rename field belongs to the native clipboard and spelling menu
        // (`main/window/contextMenu.ts`), which `preventDefault` would keep from ever being asked.
        // Decided before `open`, which prevents it unconditionally — that is the hook's contract.
        if (isTyping(event.target)) return
        menu.open(event)
      }}
    >
      <TrackHeadersName documentId={documentId} track={track} dimmed={!audible} />

      <div className="flex items-center gap-0.5">
        {TRACK_FLAGS.map(flag => (
          <TrackFlagButton
            key={flag.key}
            flag={flag}
            on={track[flag.key]}
            name={track.name}
            tooltip={TIP_RIGHT}
            onToggle={next => write(current => ({ ...current, [flag.key]: next }))}
          />
        ))}
        {/* The keyboard's way to the same three rows: `contextmenu` from Shift+F10 targets the
            focused element, and the listener above it never sees it. */}
        <MenuButton
          icon={mdiDotsHorizontal}
          label={t('timeline.trackActions', { name: track.name })}
          description={t('timeline.trackActionsHint')}
          tooltip={TIP_RIGHT}
          variant="header"
          rowCount={rows.length}
          opensOnClick
          rows={close => renderMenuRows(rows, close)}
        />
      </div>

      <ResizeHandle
        axis="vertical"
        size={track.height}
        // One height per frame: a pointermove is faster than a paint, and each of them clones the
        // whole montage — sixteen copies of every track for one frame of a drag.
        onSize={height =>
          heightCoalesce.current.schedule(height, next =>
            write(current => ({ ...current, height: clampTrackHeight(next) })),
          )
        }
      />

      {menu.at && (
        <ContextMenu at={menu.at} onClose={menu.close}>
          {renderMenuRows(rows, menu.close)}
        </ContextMenu>
      )}
    </TimelineRow>
  )
}
