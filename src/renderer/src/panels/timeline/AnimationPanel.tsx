import {
  mdiMovieOpenOutline,
  mdiPause,
  mdiPlay,
  mdiRecordCircleOutline,
  mdiRhombus,
  mdiSkipPrevious,
} from '@mdi/js'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { secondsToUs, snapToFrame, usToSeconds, type Us } from '@shared/domain/time'
import { EmptyState } from '@/design/EmptyState'
import { NumberField } from '@/design/NumberField'
import { Timecode } from '@/design/Timecode'
import { ToolButton } from '@/design/ToolButton'
import { CONTROL } from '@/design/styles'
import { clampPlayhead } from '@/engines/scene/animation-eval'
import { keySubject, setTimelineSettings } from '@/engines/scene/animation-commands'
import { animationRows, type ClipBlock } from '@/engines/scene/animation-rows'
import { cn } from '@/helpers/cn'
import { TIP_TOP } from '@/helpers/tooltip'
import { selectedNodes } from '@/engines/scene/scene-state'
import { bonesOfNode, useModelClips } from '@/stores/model-clips'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animation-view'
import { useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/scene-engines'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews, viewOf } from '@/stores/scene-views'
import { AnimationCanvas } from './AnimationCanvas'
import { AnimationHeaders } from './AnimationHeaders'

export type AnimationPanelProps = { documentId: string }

/** What a film is written at. One size for now, and a setting the day somebody asks for one. */
const FILM_WIDTH = 1920
const FILM_HEIGHT = 1080

/** What a band may be asked to last, in seconds — a frame at the low end, an hour at the top. */
const MIN_DURATION = 0.1
const MAX_DURATION = 3_600

/** A speed of zero would make a block infinitely long; the inspector never offers less. */
const MIN_SPEED = 0.1

const MIN_FPS = 1
const MAX_FPS = 120

/**
 * The animation of a 3D scene, laid out as a dope sheet: one line per object, its channels
 * folded underneath, and the keys as diamonds along a graduated ruler.
 *
 * Tracks ADD UP here rather than take turns — that was the decision, and it is why moving an
 * object writes into its rest pose unless auto-key is on: with the head recording, a drag
 * becomes a key instead, which is what `movesToCommand` reads the flag for.
 */
export function AnimationPanel({ documentId }: AnimationPanelProps) {
  const { t } = useTranslation()
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const view = useSceneViews(state => viewOf(state, documentId))
  const expandedList = useAnimationViews(state => animationViewOf(state, documentId).expanded)

  usePlayback(documentId, view.playing, timeline.duration)

  // Both memos are keyed on identities zustand keeps stable; building either inside a selector
  // would hand it a new snapshot every render and the subscription would never settle.
  const expanded = useMemo(() => keySetOf(expandedList), [expandedList])
  const lengths = useModelClips(state => state.lengths[documentId])
  const rows = useMemo(() => {
    const byId = new Map(nodes.map(node => [node.id, node]))

    // A block's width comes from the ENGINE: the length of a clip lives in the GLB, and a model
    // still loading has none — it simply has no block yet rather than a block of no width.
    const clips: ClipBlock[] = []
    for (const node of byId.values()) {
      if (node.type !== 'model') continue
      const ref = node.model.animation
      const seconds = ref ? (lengths?.[node.id]?.[ref.clip] ?? null) : null
      if (!ref || seconds === null) continue

      clips.push({
        nodeId: node.id,
        name: ref.clip,
        start: ref.start,
        duration: secondsToUs(seconds / Math.max(ref.speed, MIN_SPEED)),
      })
    }

    return animationRows(timeline, { nodes, expanded, clips })
  }, [timeline, nodes, expanded, lengths])

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AnimationBar documentId={documentId} anchor={anchor} />

      {rows.length === 0 ? (
        <EmptyState icon={mdiRhombus} message={t('animation.noTrack')} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <AnimationHeaders documentId={documentId} rows={rows} />
          <div className="min-w-0 flex-1">
            <AnimationCanvas documentId={documentId} rows={rows} />
          </div>
        </div>
      )}
    </div>
  )
}

type BarProps = {
  documentId: string
  anchor: { id: string; name: string } | null
}

function AnimationBar({ documentId, anchor }: BarProps) {
  const { t } = useTranslation()
  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const view = useSceneViews(state => viewOf(state, documentId))
  const autoKey = useAnimationViews(state => animationViewOf(state, documentId).autoKey)

  const bones = useModelClips(state => bonesOfNode(state, documentId, anchor?.id ?? ''))
  const picked = useSceneViews(state => viewOf(state, documentId).pickedBone)
  const [chosen, setChosen] = useState('')

  // The pose mode decides when it has picked one: clicking a bone in the viewport is a clearer
  // statement of intent than a picker two panels away, so it wins over what was chosen there.
  const bone = picked?.nodeId === anchor?.id ? (picked?.bone ?? chosen) : chosen

  const write = (settings: Partial<{ duration: Us; fps: number }>): void =>
    useScenes.getState().runCommand(documentId, setTimelineSettings(settings))

  return (
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
      <Timecode time={view.playhead} fps={timeline.fps} />

      <ToolButton
        icon={mdiRecordCircleOutline}
        label={t('animation.autoKey')}
        description={t('animation.autoKeyHint')}
        tooltip={TIP_TOP}
        variant="header"
        active={autoKey}
        onClick={() => useAnimationViews.getState().setAutoKey(documentId, !autoKey)}
      />
      <KeyButton documentId={documentId} />

      <div className="flex-1" />

      <div className="flex w-40 items-center">
        <NumberField
          label={t('animation.duration')}
          value={usToSeconds(timeline.duration)}
          min={MIN_DURATION}
          max={MAX_DURATION}
          step={0.1}
          layout="inline"
          onChange={seconds => write({ duration: secondsToUs(seconds) })}
        />
      </div>
      <div className="flex w-32 items-center">
        <NumberField
          label={t('animation.fps')}
          value={timeline.fps}
          min={MIN_FPS}
          max={MAX_FPS}
          step={1}
          layout="inline"
          onChange={fps => write({ fps })}
        />
      </div>

      {bones.length > 0 && (
        <select
          aria-label={t('animation.bone')}
          value={bone}
          onChange={event => setChosen(event.target.value)}
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
    </div>
  )
}

/**
 * One key on every channel of every selected subject, at the head — Blender's `LocRotScale`.
 *
 * It writes what each channel already stands at, never a neutral: a key holding nothing moves
 * nothing, and that is what made the old diamond button appear to do nothing at all.
 */
function KeyButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const tracks = useScenes(state => sceneOf(state, documentId).animation.tracks)
  const playhead = useSceneViews(state => viewOf(state, documentId).playhead)

  return (
    <ToolButton
      icon={mdiRhombus}
      label={t('animation.keyAll')}
      description={t('animation.keyAllHint')}
      tooltip={TIP_TOP}
      variant="header"
      disabled={tracks.length === 0}
      onClick={() => {
        const store = useScenes.getState()
        const state = sceneOf(store, documentId)
        const command = keySubject(
          state,
          tracks.map(track => track.id),
          snapToFrame(playhead, state.animation.fps),
        )
        if (command) store.runCommand(documentId, command)
      }}
    />
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
function usePlayback(documentId: string, playing: boolean, duration: Us): void {
  useEffect(() => {
    if (!playing) return

    let frame = 0
    let last = performance.now()

    const step = (now: number): void => {
      // Read from the store rather than from a prop: the effect must not restart on the very
      // frames it causes, and a ref written during render is not allowed either.
      const views = useSceneViews.getState()
      // `performance.now()` counts milliseconds; the head counts microseconds.
      const next = viewOf(views, documentId).playhead + (now - last) * 1000
      last = now

      if (next >= duration) {
        views.setPlayhead(documentId, duration)
        views.setPlaying(documentId, false)
        return
      }
      views.setPlayhead(documentId, clampPlayhead(next, duration))
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [documentId, playing, duration])
}
