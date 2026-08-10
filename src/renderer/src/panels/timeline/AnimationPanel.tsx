import {
  mdiCircleMedium,
  mdiDeleteOutline,
  mdiMovieOpenOutline,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiRhombus,
  mdiSkipPrevious,
} from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TRACK_PROPERTIES, type AnimationTrack, type TrackProperty } from '@shared/domain/animation'
import { EmptyState } from '@/design/EmptyState'
import { ToolButton } from '@/design/ToolButton'
import { CONTROL } from '@/design/styles'
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
import { bonesOfNode, useModelClips } from '@/stores/model-clips'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/scene-engines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews, viewOf } from '@/stores/scene-views'
import { TRACK_FLAGS } from './track-flags'

export type AnimationPanelProps = { documentId: string }

/** How wide the header column is, so the rows and the ruler line up on one gauge. */
const HEADER = 'w-(--sc-track-header)'

/** What a film is written at. One size for now, and a setting the day somebody asks for one. */
const FILM_WIDTH = 1920
const FILM_HEIGHT = 1080

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
  const bones = useModelClips(state => bonesOfNode(state, documentId, anchor?.id ?? ''))
  const [bone, setBone] = useState('')

  const addTrack = (property: TrackProperty): void => {
    if (!anchor) return

    // On the bone the picker names, when one is picked: a rig is corrected bone by bone, and a
    // track on the model itself would move the whole character instead of its arm.
    const target = bone ? { nodeId: anchor.id, bone, property } : { nodeId: anchor.id, property }
    const subject = bone ? `${anchor.name} · ${bone}` : anchor.name

    useScenes
      .getState()
      .runCommand(
        documentId,
        addAnimationTrack(target, `${subject} · ${t(`animation.${property}`)}`, `track_${newId()}`),
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

        {bones.length > 0 && (
          <select
            aria-label={t('animation.bone')}
            value={bone}
            onChange={event => setBone(event.target.value)}
            className={cn(CONTROL, 'max-w-40 px-1')}
          >
            <option value="">{t('animation.wholeModel')}</option>
            {bones.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        <RenderButton documentId={documentId} />

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
 * Writes the film. The camera is the first one the scene holds — a scene without one has nothing
 * to render FROM, so the button says that rather than being missing.
 *
 * The work is the engine's: it draws each frame off screen and hands the bytes over one at a
 * time, and this only carries them to the main process. Awaited frame by frame on purpose —
 * running ahead would hold a whole film in memory.
 */
function RenderButton({ documentId }: AnimationPanelProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const camera = nodes.find(node => node.type === 'camera')

  const render = async (): Promise<void> => {
    const engine = sceneEngineOf(documentId)
    const bridge = getBridge()
    if (!engine || !bridge || !camera) return

    const { animation } = sceneOf(useScenes.getState(), documentId)
    const title = useDocuments.getState().documents[documentId]?.title ?? 'render'

    setBusy(true)
    const id = await bridge.render.start({ name: title, fps: animation.fps })
    if (!id) {
      setBusy(false)
      return
    }

    try {
      await engine.renderFilm(
        camera.id,
        {
          width: FILM_WIDTH,
          height: FILM_HEIGHT,
          fps: animation.fps,
          duration: animation.duration,
        },
        (index, png) => bridge.render.frame({ id, index, png }),
      )
      await bridge.render.finish(id)
    } catch (error) {
      await bridge.render.cancel(id)
      reportFailure('scene.render', title, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolButton
      icon={mdiMovieOpenOutline}
      label={t('animation.render')}
      description={camera ? t('animation.renderHint') : t('animation.renderNeedsCamera')}
      tooltip={TIP_TOP}
      variant="header"
      disabled={!camera || busy}
      onClick={() => void render()}
    />
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
