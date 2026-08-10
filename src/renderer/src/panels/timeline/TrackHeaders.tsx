import { mdiDotsHorizontal } from '@mdi/js'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { ResizeHandle } from '@/design/ResizeHandle'
import { ToolButton } from '@/design/ToolButton'
import { addTrack, renameTrack } from '@/engines/timeline/commands'
import { RULER_HEIGHT } from '@/engines/timeline/timeline-geometry'
import {
  clampTrackHeight,
  playsThrough,
  TRACK_KINDS,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { useSelection } from '@/stores/selection'
import { sequenceOf, useSequences, writeTrack } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'
import { TRACK_FLAGS, TRACK_KIND_ICONS } from './track-flags'
import { TrackMenu, TrackMenuRows, TRACK_MENU_ROWS } from './TrackMenu'

export type TrackHeadersProps = { documentId: string }

/**
 * The column standing beside the canvas: one row per track, aligned with the rows it names.
 *
 * DOM rather than canvas, unlike the strip itself. These are controls — a text field, three
 * toggles, a drag handle — and reimplementing focus, hit areas and accessible names inside a
 * canvas would be rebuilding the browser. The clips stay painted; only their labels are here.
 */
export function TrackHeaders({ documentId }: TrackHeadersProps) {
  const sequence = useSequences(state => sequenceOf(state, documentId))
  const scrollTop = useTimelineView(state => viewportOf(state, documentId).scrollTop)

  return (
    <div className="border-border flex w-(--sc-track-header) shrink-0 flex-col overflow-hidden border-r">
      {/* Empty band facing the ruler, so row one lines up with track one. */}
      <div style={{ height: RULER_HEIGHT }} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
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
        </div>
      </div>
      <AddTrackBar documentId={documentId} />
    </div>
  )
}

/**
 * The one place a track is born, at the foot of the column it will join. One button per kind
 * rather than one button that guesses: a video track and an audio track are not the same row,
 * and a sequence can legitimately want either.
 */
function AddTrackBar({ documentId }: TrackHeadersProps) {
  const { t } = useTranslation()

  return (
    <div className="border-border flex shrink-0 items-center gap-0.5 border-t px-1.5 py-1">
      {TRACK_KINDS.map(kind => (
        <ToolButton
          key={kind}
          icon={TRACK_KIND_ICONS[kind]}
          label={t(`timeline.addTrack.${kind}`)}
          tooltip={TIP_RIGHT}
          variant="header"
          onClick={() => useSequences.getState().runCommand(documentId, addTrack(kind))}
        />
      ))}
    </div>
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
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  // Renaming is an edit and goes through a command; the rest is state — see `writeTrack`.
  const write = (change: (current: Track) => Track): void =>
    writeTrack(documentId, track.id, change)

  const audible = playsThrough(sequence, track)
  const rows = { documentId, trackId: track.id, canRise, canFall }

  return (
    <div
      className="flex flex-col justify-between px-1.5 py-1"
      style={{ height: track.height }}
      data-testid={`track-header-${track.id}`}
      onPointerDown={() => useSelection.getState().selectTrack(documentId, track.id)}
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
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

      {menuAt && <TrackMenu {...rows} at={menuAt} onClose={() => setMenuAt(null)} />}
    </div>
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
  const [editing, setEditing] = useState<string | null>(null)

  const commit = (): void => {
    if (editing !== null)
      useSequences.getState().runCommand(documentId, renameTrack(track.id, editing))
    setEditing(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Stopped here: the strip binds bare letters, and typing a name must not split a clip.
    event.stopPropagation()
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setEditing(null)
  }

  if (editing !== null) {
    return (
      <input
        autoFocus
        aria-label={t('timeline.rename')}
        className="bg-surface text-text w-full rounded-(--radius-sc-sm) px-1 text-[11px] outline-none"
        value={editing}
        onChange={event => setEditing(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    )
  }

  return (
    <span
      {...TIP_RIGHT(t('timeline.renameHint'))}
      className={cn('cursor-text truncate text-[11px]', dimmed ? 'text-muted' : 'text-text')}
      onDoubleClick={() => setEditing(track.name)}
    >
      {track.name}
    </span>
  )
}
