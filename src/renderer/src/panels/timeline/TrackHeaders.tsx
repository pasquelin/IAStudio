import { mdiDotsHorizontal } from '@mdi/js'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContextMenu } from '@/design/ContextMenu'
import { MenuButton } from '@/design/MenuButton'
import { ResizeHandle } from '@/design/ResizeHandle'
import { ToolButton } from '@/design/ToolButton'
import { moveTrack, renameTrack } from '@/engines/timeline/commands'
import {
  clampTrackHeight,
  playsThrough,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
import type { Viewport } from '@/engines/timeline/timeline-geometry'
import { clamp } from '@shared/numeric'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { isTyping } from '@/helpers/typing'
import { InlineRename } from '@/panels/shared/InlineRename'
import { useSelection } from '@/stores/selection'
import { sequenceOf, useSequences, writeTrack } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'
import { TimelineHeaderColumn, TimelineRow } from './TimelineRow'
import { TRACK_FLAGS } from './track-flags'
import { TrackMenu, TrackMenuRows, TRACK_MENU_ROWS } from './TrackMenu'

export type TrackHeadersProps = { documentId: string }

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
        <TrackHeader
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

type TrackHeaderProps = {
  documentId: string
  sequence: SequenceState
  track: Track
  canRise: boolean
  canFall: boolean
}

function TrackHeader({ documentId, sequence, track, canRise, canFall }: TrackHeaderProps) {
  const { t } = useTranslation()
  const menu = useContextMenu()

  // Renaming is an edit and goes through a command; the rest is state — see `writeTrack`.
  const write = (change: (current: Track) => Track): void =>
    writeTrack(documentId, track.id, change)

  const audible = playsThrough(sequence, track)
  const rows = { documentId, trackId: track.id, canRise, canFall }

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
      onPointerDown={() => useSelection.getState().selectTrack(documentId, track.id)}
      onContextMenu={event => {
        // A right-click in the rename field belongs to the native clipboard and spelling menu
        // (`main/window/context-menu.ts`), which `preventDefault` would keep from ever being asked.
        // Decided before `open`, which prevents it unconditionally — that is the hook's contract.
        if (isTyping(event.target)) return
        menu.open(event)
      }}
    >
      <TrackName documentId={documentId} track={track} dimmed={!audible} />

      <div className="flex items-center gap-0.5">
        {TRACK_FLAGS.map(flag => (
          <ToolButton
            key={flag.key}
            icon={flag.iconFor(track[flag.key])}
            label={t(flag.labelKey, { name: track.name })}
            tooltip={TIP_RIGHT}
            variant="header"
            active={track[flag.key]}
            onClick={() => write(current => ({ ...current, [flag.key]: !current[flag.key] }))}
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
          rowCount={TRACK_MENU_ROWS}
          opensOnClick
          rows={close => <TrackMenuRows {...rows} onClose={close} />}
        />
      </div>

      <ResizeHandle
        axis="vertical"
        size={track.height}
        onSize={height => write(current => ({ ...current, height: clampTrackHeight(height) }))}
      />

      {menu.at && <TrackMenu {...rows} at={menu.at} onClose={menu.close} />}
    </TimelineRow>
  )
}

function TrackName({
  documentId,
  track,
  dimmed,
}: {
  documentId: string
  track: Track
  dimmed: boolean
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)

  if (renaming) {
    return (
      <InlineRename
        value={track.name}
        label={t('timeline.rename')}
        // The name shares its row with the three toggles under it: measured on screen, the row
        // holds 48px of content and the toggles alone take 28.
        gauge="inline"
        // Guarded, because the field commits the ORIGINAL name on Escape: without it an
        // abandoned edit lands on the undo stack, and the next ⌘Z visibly does nothing.
        onCommit={name => {
          setRenaming(false)
          if (name !== track.name)
            useSequences.getState().runCommand(documentId, renameTrack(track.id, name))
        }}
      />
    )
  }

  return (
    <span
      {...TIP_RIGHT(t('timeline.renameHint'))}
      className={cn('text-tiny cursor-text truncate', dimmed ? 'text-muted' : 'text-text')}
      onDoubleClick={() => setRenaming(true)}
    >
      {track.name}
    </span>
  )
}
