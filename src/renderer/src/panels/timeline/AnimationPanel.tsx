import { mdiRhombus } from '@mdi/js'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { secondsToUs, type Us } from '@shared/domain/time'
import { EmptyState } from '@/design/EmptyState'
import { clampPlayhead } from '@/engines/scene/animation-eval'
import { animationRows, type ClipBlock } from '@/engines/scene/animation-rows'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animation-view'
import { useModelClips } from '@/stores/model-clips'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/scene-views'
import { AnimationCanvas } from './AnimationCanvas'
import { AnimationHeaders } from './AnimationHeaders'

export type AnimationPanelProps = { documentId: string }

/** A speed of zero would make a block infinitely long; the inspector never offers less. */
const MIN_SPEED = 0.1

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
  const view = useSceneViews(state => sceneViewOf(state, documentId))
  const expandedList = useAnimationViews(state => animationViewOf(state, documentId).expanded)

  usePlayback(documentId, view.playing, timeline.duration)
  useHeadInsideBand(documentId, view.playhead, timeline.duration)

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

  return (
    <div className="flex h-full min-h-0 flex-col">
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
      const next = sceneViewOf(views, documentId).playhead + (now - last) * 1000
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

/**
 * Pulls the head back inside the band when the band is shortened under it.
 *
 * Nothing else would: shortening is an edit of the document, the head is session state, and the
 * two never meet. Left outside, the head sits where no key can stand, and Play stops on the frame
 * it starts on — the very defect the rewind was added to close.
 */
function useHeadInsideBand(documentId: string, playhead: Us, duration: Us): void {
  useEffect(() => {
    if (playhead <= duration) return
    useSceneViews.getState().setPlayhead(documentId, duration)
  }, [documentId, playhead, duration])
}
