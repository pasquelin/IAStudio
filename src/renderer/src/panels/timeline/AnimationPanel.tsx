import {
  mdiCircleMedium,
  mdiDeleteOutline,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiRhombus,
  mdiSkipPrevious,
} from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TRACK_PROPERTIES, type AnimationTrack, type TrackProperty } from '@shared/domain/animation'
import { EmptyState } from '@/design/EmptyState'
import { ToolButton } from '@/design/ToolButton'
import { clampPlayhead, keyAt, snapToFrame } from '@/engines/scene/animation-eval'
import {
  addAnimationTrack,
  removeAnimationKey,
  removeAnimationTrack,
  setAnimationKey,
} from '@/engines/scene/animation-commands'
import { neutralOf } from '@shared/domain/animation'
import { cn } from '@/helpers/cn'
import { newId } from '@/helpers/ids'
import { TIP_TOP } from '@/helpers/tooltip'
import { selectedNodes } from '@/engines/scene/scene-state'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews, viewOf } from '@/stores/scene-views'
import { TRACK_FLAGS } from './track-flags'

export type AnimationPanelProps = { documentId: string }

/** How wide the header column is, so the rows and the ruler line up on one gauge. */
const HEADER = 'w-(--sc-track-header)'

/**
 * The animation of a 3D scene, along the same band a montage uses.
 *
 * Tracks ADD UP here rather than take turns — that was the decision, and it is what makes the
 * armed flag necessary: with nothing armed, the gizmo writes into a node's rest pose and every
 * track drags it straight back on the next frame.
 */
export function AnimationPanel({ documentId }: AnimationPanelProps) {
  const { t } = useTranslation()
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const view = useSceneViews(state => viewOf(state, documentId))

  usePlayback(documentId, view.playing, timeline.duration)

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null

  const addTrack = (property: TrackProperty): void => {
    if (!anchor) return
    useScenes
      .getState()
      .runCommand(
        documentId,
        addAnimationTrack(
          { nodeId: anchor.id, property },
          `${anchor.name} · ${t(`animation.${property}`)}`,
          `track_${newId()}`,
        ),
      )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 items-center gap-1.5 border-b px-1.5 py-1">
        <ToolButton
          icon={mdiSkipPrevious}
          label={t('animation.toStart')}
          tooltip={TIP_TOP}
          variant="header"
          onClick={() => useSceneViews.getState().setPlayhead(documentId, 0)}
        />
        <ToolButton
          icon={view.playing ? mdiPause : mdiPlay}
          label={view.playing ? t('animation.pause') : t('animation.play')}
          tooltip={TIP_TOP}
          variant="header"
          active={view.playing}
          onClick={() => useSceneViews.getState().setPlaying(documentId, !view.playing)}
        />
        <span className="text-muted text-[11px] tabular-nums">
          {view.playhead.toFixed(2)} / {timeline.duration.toFixed(2)} s
        </span>

        <div className="flex-1" />

        {TRACK_PROPERTIES.map(property => (
          <ToolButton
            key={property}
            icon={mdiPlus}
            label={t('animation.addTrack', { property: t(`animation.${property}`) })}
            tooltip={TIP_TOP}
            variant="header"
            disabled={!anchor}
            onClick={() => addTrack(property)}
          />
        ))}
      </div>

      {timeline.tracks.length === 0 ? (
        <EmptyState icon={mdiRhombus} message={t('animation.noTrack')} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {timeline.tracks.map(track => (
            <TrackRow
              key={track.id}
              documentId={documentId}
              track={track}
              playhead={view.playhead}
              duration={timeline.duration}
              fps={timeline.fps}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Runs the head forward while it plays. A `requestAnimationFrame` rather than the engine's own
 * loop: the head is session state React owns, and the engine is told where it stands — never the
 * other way round, which is invariant 4.
 */
function usePlayback(documentId: string, playing: boolean, duration: number): void {
  useEffect(() => {
    if (!playing) return

    let frame = 0
    let last = performance.now()

    const step = (now: number): void => {
      // Read from the store rather than from a prop: the effect must not restart on the very
      // frames it causes, and a ref written during render is not allowed either.
      const views = useSceneViews.getState()
      const next = viewOf(views, documentId).playhead + (now - last) / 1000
      last = now

      if (next >= duration) {
        views.setPlayhead(documentId, duration)
        views.setPlaying(documentId, false)
        return
      }
      views.setPlayhead(documentId, next)
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [documentId, playing, duration])
}

function TrackRow({
  documentId,
  track,
  playhead,
  duration,
  fps,
}: {
  documentId: string
  track: AnimationTrack
  playhead: number
  duration: number
  fps: number
}) {
  const { t } = useTranslation()
  const write = (change: (current: AnimationTrack) => AnimationTrack): void =>
    useScenes.setState(state => writeTrack(state, documentId, track.id, change))

  const at = snapToFrame(clampPlayhead(playhead, duration), fps)
  const standing = keyAt(track.keys, at)

  const toggleKey = (): void => {
    const command = standing
      ? removeAnimationKey(track.id, at)
      : setAnimationKey(track.id, at, neutralOf(track.target.property))
    useScenes.getState().runCommand(documentId, command)
  }

  return (
    <div
      className="border-border flex items-center border-b"
      data-testid={`anim-track-${track.id}`}
    >
      <div className={cn(HEADER, 'flex shrink-0 items-center gap-0.5 px-1.5 py-1')}>
        <span title={track.name} className="text-text min-w-0 flex-1 truncate text-[11px]">
          {track.name}
        </span>

        <ToolButton
          icon={mdiCircleMedium}
          label={t('animation.arm', { name: track.name })}
          tooltip={TIP_TOP}
          variant="header"
          active={track.armed}
          onClick={() => write(current => ({ ...current, armed: !current.armed }))}
        />
        {TRACK_FLAGS.map(flag => (
          <ToolButton
            key={flag.key}
            icon={flag.iconFor(track[flag.key])}
            label={t(flag.labelKey, { name: track.name })}
            tooltip={TIP_TOP}
            variant="header"
            active={track[flag.key]}
            onClick={() => write(current => ({ ...current, [flag.key]: !current[flag.key] }))}
          />
        ))}
        <ToolButton
          icon={mdiRhombus}
          label={standing ? t('animation.removeKey') : t('animation.addKey')}
          tooltip={TIP_TOP}
          variant="header"
          active={standing !== undefined}
          onClick={toggleKey}
        />
        <ToolButton
          icon={mdiDeleteOutline}
          label={t('animation.removeTrack', { name: track.name })}
          tooltip={TIP_TOP}
          variant="header"
          onClick={() =>
            useScenes.getState().runCommand(documentId, removeAnimationTrack(track.id))
          }
        />
      </div>

      {/* The keys, laid on the length of the timeline. A plain strip rather than a canvas: what
          it draws is a handful of diamonds, and a canvas would owe us hit testing for them. */}
      <div className="relative h-7 min-w-0 flex-1">
        {track.keys.map(key => (
          <span
            key={key.time}
            data-testid={`anim-key-${track.id}-${key.time}`}
            className="bg-accent absolute top-1/2 size-1.5 -translate-y-1/2 rotate-45"
            style={{ left: `${(key.time / duration) * 100}%` }}
          />
        ))}
        <span
          className="bg-text absolute inset-y-0 w-px"
          style={{ left: `${(at / duration) * 100}%` }}
        />
      </div>
    </div>
  )
}

/** Flags are how one works, not what one made: they stay off the undo stack, as a mute does. */
function writeTrack(
  state: ReturnType<typeof useScenes.getState>,
  documentId: string,
  trackId: string,
  change: (track: AnimationTrack) => AnimationTrack,
): Partial<ReturnType<typeof useScenes.getState>> {
  const scene = sceneOf(state, documentId)
  return {
    states: {
      ...state.states,
      [documentId]: {
        ...scene,
        animation: {
          ...scene.animation,
          tracks: scene.animation.tracks.map(track =>
            track.id === trackId ? change(track) : track,
          ),
        },
      },
    },
  }
}
