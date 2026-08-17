import { mdiRhombus } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { secondsToUs } from '@shared/domain/time'
import { EmptyState } from '@/design/EmptyState'
import { animationRows, type ClipBlock } from '@/engines/scene/animationRows'
import { useAnimationPlayback } from '@/hooks/useAnimationPlayback'
import { useHeadInsideBand } from '@/hooks/useHeadInsideBand'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animationView'
import { useModelClips } from '@/stores/modelClips'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { AnimationCanvas } from './AnimationCanvas'
import { AnimationHeaders } from './AnimationHeaders/AnimationHeaders'

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
  const order = useAnimationViews(state => animationViewOf(state, documentId).order)

  useAnimationPlayback(documentId, view.playing, timeline.duration)
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

    return animationRows(timeline, { nodes, expanded, clips, order })
  }, [timeline, nodes, expanded, lengths, order])

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
