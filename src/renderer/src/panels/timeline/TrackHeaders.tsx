import {
  mdiHeadphones,
  mdiLockOpenVariantOutline,
  mdiLockOutline,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ResizeHandle } from '@/design/ResizeHandle'
import { ToolButton } from '@/design/ToolButton'
import { renameTrack } from '@/engines/timeline/commands'
import { RULER_HEIGHT } from '@/engines/timeline/timeline-geometry'
import {
  clampTrackHeight,
  playsThrough,
  updateTrack,
  type SequenceState,
  type Track,
} from '@/engines/timeline/timeline-state'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { useSelection } from '@/stores/selection'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'

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
    <div className="border-border w-(--sc-track-header) shrink-0 overflow-hidden border-r">
      {/* Empty band facing the ruler, so row one lines up with track one. */}
      <div style={{ height: RULER_HEIGHT }} />
      <div style={{ transform: `translateY(${-scrollTop}px)` }}>
        {sequence.tracks.map(track => (
          <TrackHeader key={track.id} documentId={documentId} sequence={sequence} track={track} />
        ))}
      </div>
    </div>
  )
}

type TrackHeaderProps = { documentId: string; sequence: SequenceState; track: Track }

function TrackHeader({ documentId, sequence, track }: TrackHeaderProps) {
  const { t } = useTranslation()

  // Mute, solo, lock and height are how one works, not what one made: they go through
  // `replace`, which skips the history. Renaming is an edit, and goes through a command.
  const write = (change: (current: Track) => Track): void => {
    useSequences.getState().replace(documentId, updateTrack(sequence, track.id, change))
  }

  const audible = playsThrough(sequence, track)

  return (
    <div
      className="flex flex-col justify-between px-1.5 py-1"
      style={{ height: track.height }}
      data-testid={`track-header-${track.id}`}
      onPointerDown={() => useSelection.getState().selectTrack(track.id)}
    >
      <TrackName documentId={documentId} track={track} dimmed={!audible} />

      <div className="flex items-center gap-0.5">
        <ToolButton
          icon={track.muted ? mdiVolumeOff : mdiVolumeHigh}
          label={t('timeline.mute', { name: track.name })}
          tooltip={TIP_RIGHT}
          variant="header"
          active={track.muted}
          onClick={() => write(current => ({ ...current, muted: !current.muted }))}
        />
        <ToolButton
          icon={mdiHeadphones}
          label={t('timeline.solo', { name: track.name })}
          tooltip={TIP_RIGHT}
          variant="header"
          active={track.solo}
          onClick={() => write(current => ({ ...current, solo: !current.solo }))}
        />
        <ToolButton
          icon={track.locked ? mdiLockOutline : mdiLockOpenVariantOutline}
          label={t('timeline.lock', { name: track.name })}
          tooltip={TIP_RIGHT}
          variant="header"
          active={track.locked}
          onClick={() => write(current => ({ ...current, locked: !current.locked }))}
        />
      </div>

      <ResizeHandle
        axis="vertical"
        size={track.height}
        onSize={height => write(current => ({ ...current, height: clampTrackHeight(height) }))}
      />
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
