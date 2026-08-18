import { mdiRhombus } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { clipKeyOf, clipLane, MAIN_LANE_ID } from '@shared/domain/scene'
import { animationRows, type ClipBlock, type SheetLane } from '@/engines/scene/animationRows'
import { clipSpanOf } from '@/engines/scene/clipBlend'
import { clipLabel } from '@/helpers/clipLabel'
import { useHeadInsideBand } from '@/hooks/useHeadInsideBand'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animationView'
import { useModelClips } from '@/stores/modelClips'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { AnimationCanvas } from './AnimationCanvas'
import { AnimationHeaders } from './AnimationHeaders/AnimationHeaders'

export type AnimationPanelProps = { documentId: string }

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
  // The one field this panel reads, and not the whole view: `setPlayhead` and `setPreview` both
  // replace that object, and the band would repaint for every frame of playback and every scrub.
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)
  const expandedList = useAnimationViews(state => animationViewOf(state, documentId).expanded)
  const order = useAnimationViews(state => animationViewOf(state, documentId).order)

  useHeadInsideBand(documentId, playhead, timeline.duration)

  // Both memos are keyed on identities zustand keeps stable; building either inside a selector
  // would hand it a new snapshot every render and the subscription would never settle.
  const expanded = useMemo(() => keySetOf(expandedList), [expandedList])
  const lengths = useModelClips(state => state.lengths[documentId])
  const rows = useMemo(() => {
    const byId = new Map(nodes.map(node => [node.id, node]))

    // A block's width comes from the ENGINE: the length of a clip lives in the GLB, and a model
    // still loading has none — it simply has no block yet rather than a block of no width.
    const sheetLanes: SheetLane[] = []
    for (const node of byId.values()) {
      if (node.type !== 'model') continue

      // A model always shows a lane, empty or not: an object's track is where an animation is
      // dropped, and one that appears only once something plays has nowhere to receive the first.
      const lanes = node.model.lanes ?? [clipLane(MAIN_LANE_ID)]

      for (const [rank, lane] of lanes.entries()) {
        const blocks: ClipBlock[] = []

        for (const ref of lane.clips) {
          const seconds = lengths?.[node.id]?.[clipKeyOf(ref.source)] ?? null
          if (seconds === null) continue

          blocks.push({
            clipId: ref.id,
            // The label the studio owns, never the name the file spells — a Tripo rig writes
            // `NlaTrack` into `label` when the block came off its own file.
            name: clipLabel(ref.label, t),
            start: ref.start,
            // The same arithmetic the mixer plays by, and it has to be: a bar drawn wider than
            // what is heard is a bar whose end shows a pose nothing holds.
            duration: clipSpanOf(ref, seconds),
          })
        }

        sheetLanes.push({
          nodeId: node.id,
          laneId: lane.id,
          name: t('animation.lane', { index: rank + 1 }),
          blocks,
        })
      }
    }

    return animationRows(timeline, { nodes, expanded, lanes: sheetLanes, order })
  }, [timeline, nodes, expanded, lengths, order, t])

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
