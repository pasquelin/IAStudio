import { mdiChevronDown, mdiChevronRight, mdiDeleteOutline, mdiRhombus } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { TrackProperty } from '@shared/domain/animation'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { keyNode, removeAnimationTrack } from '@/engines/scene/animation-commands'
import { newId } from '@/helpers/ids'
import type { AnimationRow, ChannelRow, ClipRow, SubjectRow } from '@/engines/scene/animation-rows'
import { RULER_HEIGHT } from '@/engines/timeline/timeline-geometry'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
import { useSceneViews, viewOf } from '@/stores/scene-views'
import { TRACK_FLAGS } from './track-flags'

/** A row id back into the pair its channels are addressed by — the inverse of `subjectKey`. */
function subjectOf(rowId: string): { nodeId: string; bone?: string } {
  const cut = rowId.indexOf('/')
  return cut === -1
    ? { nodeId: rowId }
    : { nodeId: rowId.slice(0, cut), bone: rowId.slice(cut + 1) }
}

/** What each channel is called, composed once so a created channel is named like an added one. */
function channelNames(t: (key: string) => string, subject: string): Record<TrackProperty, string> {
  return {
    position: `${subject} · ${t('animation.position')}`,
    rotation: `${subject} · ${t('animation.rotation')}`,
    scale: `${subject} · ${t('animation.scale')}`,
  }
}

export type AnimationHeadersProps = {
  documentId: string
  rows: readonly AnimationRow[]
}

/**
 * The column beside the band: one line per row, aligned with the row it names.
 *
 * The name and the switches are stacked, never laid side by side. Side by side is what the old
 * panel did, and six non-shrinking buttons in a 140 px column left the name exactly zero pixels
 * wide — no track ever showed what it drove.
 */
export function AnimationHeaders({ documentId, rows }: AnimationHeadersProps) {
  const scrollTop = useAnimationViews(
    state => animationViewOf(state, documentId).viewport.scrollTop,
  )

  return (
    <div className="border-border flex w-(--sc-track-header) shrink-0 flex-col overflow-hidden border-r">
      {/* Empty band facing the ruler, so line one lines up with row one. */}
      <div style={{ height: RULER_HEIGHT }} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
          {rows.map(row => (
            <HeaderRow key={row.id} documentId={documentId} row={row} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HeaderRow({ documentId, row }: { documentId: string; row: AnimationRow }) {
  if (row.kind === 'subject') return <SubjectHeader documentId={documentId} row={row} />
  if (row.kind === 'channel') return <ChannelHeader documentId={documentId} row={row} />
  return <ClipHeader row={row} />
}

/** A block names the clip it plays, and offers nothing else: it is driven from the inspector. */
function ClipHeader({ row }: { row: ClipRow }) {
  return (
    <div
      className="flex items-center pr-1 pl-4"
      style={{ height: row.height }}
      data-testid={`anim-clip-${row.nodeId}`}
    >
      <span className="text-muted text-tiny min-w-0 flex-1 truncate" {...HINT_RIGHT(row.name)}>
        {row.name}
      </span>
    </div>
  )
}

type SubjectRowProps = { documentId: string; row: SubjectRow }

function SubjectHeader({ documentId, row }: SubjectRowProps) {
  const { t } = useTranslation()
  const playhead = useSceneViews(state => viewOf(state, documentId).playhead)

  const key = (): void => {
    const store = useScenes.getState()
    const command = keyNode(
      sceneOf(store, documentId),
      subjectOf(row.id),
      playhead,
      channelNames(t, row.name),
      () => `track_${newId()}`,
    )
    if (command) store.runCommand(documentId, command)
  }

  return (
    <div
      className="flex flex-col justify-between px-1 py-0.5"
      style={{ height: row.height }}
      data-testid={`anim-subject-${row.id}`}
    >
      <button
        type="button"
        {...HINT_RIGHT(t('animation.foldHint'))}
        className="text-text text-tiny flex min-w-0 items-center gap-0.5 text-left"
        onClick={() => useAnimationViews.getState().toggleExpanded(documentId, row.id)}
      >
        <UiIcon path={row.expanded ? mdiChevronDown : mdiChevronRight} size={12} />
        <span className="min-w-0 flex-1 truncate">{row.name}</span>
      </button>

      <div className="flex items-center gap-0.5">
        <ToolButton
          icon={mdiRhombus}
          label={t('animation.keySubject', { name: row.name })}
          description={t('animation.keySubjectHint')}
          tooltip={TIP_RIGHT}
          variant="header"
          onClick={key}
        />
        {TRACK_FLAGS.map(flag => (
          <ToolButton
            key={flag.key}
            icon={flag.iconFor(row.tracks.every(track => track[flag.key]))}
            label={t(flag.labelKey, { name: row.name })}
            tooltip={TIP_RIGHT}
            variant="header"
            active={row.tracks.every(track => track[flag.key])}
            onClick={() => {
              // Every channel takes the opposite of what they ALL are, so a mixed subject turns
              // fully on rather than each channel flipping its own way.
              const next = !row.tracks.every(track => track[flag.key])
              for (const track of row.tracks) {
                writeAnimationTrack(documentId, track.id, current => ({
                  ...current,
                  [flag.key]: next,
                }))
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

type ChannelRowProps = { documentId: string; row: ChannelRow }

function ChannelHeader({ documentId, row }: ChannelRowProps) {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-0.5 pr-1 pl-4"
      style={{ height: row.height }}
      data-testid={`anim-channel-${row.id}`}
    >
      <span
        className={cn('text-muted text-tiny min-w-0 flex-1 truncate')}
        {...HINT_RIGHT(row.name)}
      >
        {row.name}
      </span>
      <ToolButton
        icon={mdiDeleteOutline}
        label={t('animation.removeTrack', { name: row.name })}
        tooltip={TIP_RIGHT}
        variant="header"
        onClick={() =>
          useScenes.getState().runCommand(documentId, removeAnimationTrack(row.track.id))
        }
      />
    </div>
  )
}
