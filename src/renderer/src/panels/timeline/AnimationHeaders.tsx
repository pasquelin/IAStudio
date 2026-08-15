import { mdiChevronDown, mdiChevronRight, mdiDeleteOutline, mdiRhombus } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TrackProperty } from '@shared/domain/animation'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { keyNode, removeAnimationTrack, unkeySubject } from '@/engines/scene/animation-commands'
import { snapToFrame } from '@shared/domain/time'
import { newId } from '@/helpers/ids'
import {
  trackIdsOf,
  type AnimationRow,
  type ChannelRow,
  type ClipRow,
  type SubjectRow,
} from '@/engines/scene/animation-rows'
import { HINT_RIGHT, TIP_RIGHT } from '@/helpers/tooltip'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
import { useSceneViews, sceneViewOf } from '@/stores/scene-views'
import { TimelineHeaderColumn, TimelineRow } from './TimelineRow'
import { isFlagOnAll, TRACK_FLAGS } from './track-flags'

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

function shownSubjects(rows: readonly AnimationRow[]): string[] {
  return rows.filter(row => row.kind === 'subject').map(row => row.id)
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
  // Memoised on `rows`, whose identity the panel keeps stable: this column re-renders on every
  // frame of playback, and two arrays allocated per frame is two arrays nobody reads.
  const shown = useMemo(() => shownSubjects(rows), [rows])

  return (
    <TimelineHeaderColumn scrollTop={scrollTop}>
      {rows.map(row => (
        <HeaderRow key={row.id} documentId={documentId} row={row} shown={shown} />
      ))}
    </TimelineHeaderColumn>
  )
}

type HeaderRowProps = { documentId: string; row: AnimationRow; shown: readonly string[] }

function HeaderRow({ documentId, row, shown }: HeaderRowProps) {
  if (row.kind === 'subject')
    return <SubjectHeader documentId={documentId} row={row} shown={shown} />
  if (row.kind === 'channel') return <ChannelHeader documentId={documentId} row={row} />
  return <ClipHeader row={row} />
}

/** A block names the clip it plays, and offers nothing else: it is driven from the inspector. */
function ClipHeader({ row }: { row: ClipRow }) {
  return (
    <TimelineRow height={row.height} nested data-testid={`anim-clip-${row.nodeId}`}>
      <span className="text-muted text-tiny min-w-0 truncate" {...HINT_RIGHT(row.name)}>
        {row.name}
      </span>
    </TimelineRow>
  )
}

type SubjectRowProps = { documentId: string; row: SubjectRow; shown: readonly string[] }

function SubjectHeader({ documentId, row, shown }: SubjectRowProps) {
  const { t } = useTranslation()
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)
  const fps = useScenes(state => sceneOf(state, documentId).animation.fps)

  const at = snapToFrame(playhead, fps)
  const standing = row.keys.includes(at)

  const key = (): void => {
    const store = useScenes.getState()
    const state = sceneOf(store, documentId)

    // Pressed where a key already stands, it takes that key off: a pose one cannot undo is a
    // pose one is stuck with, and nothing else in the panel removes one.
    const command = standing
      ? unkeySubject(state, trackIdsOf(row), at)
      : keyNode(state, subjectOf(row.id), at, channelNames(t, row.name), () => `track_${newId()}`)

    if (command) store.runCommand(documentId, command)
  }

  return (
    <TimelineRow
      height={row.height}
      reorder={{
        label: t('animation.reorderRow', { name: row.name }),
        // The sheet's own arrangement, never the scene: the outliner keeps the hierarchy it has.
        // No gesture around it either — an arrangement is a way of looking, and no history holds it.
        move: by => useAnimationViews.getState().moveRow(documentId, shown, row.id, by),
      }}
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
          label={
            standing
              ? t('animation.unkeySubject', { name: row.name })
              : t('animation.keySubject', { name: row.name })
          }
          description={standing ? t('animation.unkeySubjectHint') : t('animation.keySubjectHint')}
          tooltip={TIP_RIGHT}
          variant="header"
          active={standing}
          onClick={key}
        />
        {TRACK_FLAGS.map(flag => (
          <ToolButton
            key={flag.key}
            icon={flag.iconFor(isFlagOnAll(row.tracks, flag))}
            label={t(flag.labelKey, { name: row.name })}
            tooltip={TIP_RIGHT}
            variant="header"
            active={isFlagOnAll(row.tracks, flag)}
            onClick={() => {
              // Every channel takes the opposite of what they ALL are, so a mixed subject turns
              // fully on rather than each channel flipping its own way.
              const next = !isFlagOnAll(row.tracks, flag)
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
    </TimelineRow>
  )
}

type ChannelRowProps = { documentId: string; row: ChannelRow }

function ChannelHeader({ documentId, row }: ChannelRowProps) {
  const { t } = useTranslation()

  return (
    <TimelineRow height={row.height} nested data-testid={`anim-channel-${row.id}`}>
      <div className="flex items-center gap-0.5">
        <span className="text-muted text-tiny min-w-0 flex-1 truncate" {...HINT_RIGHT(row.name)}>
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
    </TimelineRow>
  )
}
