import { mdiRhombus } from '@mdi/js'
import { useMemo, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/EmptyState'
import { PanelHeader } from '@pasquelin/panels'
import { putOnAnimationSheet } from '@/engines/scene/animationCommands'
import { sceneNodeDrag } from '@/features/scene/components/dragged'
import { clipKeyOf, clipLane, MAIN_LANE_ID } from '@shared/domain/scene'
import { animationRows, type SheetLane } from '@/engines/scene/animationRows'
import { type ClipBlock } from '@/engines/timeline/bandRows'
import { clipSpanOf } from '@/engines/scene/clipBlend'
import { clipRefLabel } from '@/helpers/clipLabel'
import { useHeadInsideBand } from '@/hooks/useHeadInsideBand'
import {
  playedBlockOf,
  TimelineClipSettings,
} from '../../../timeline/components/Timeline/TimelineClipSettings'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animationView'
import { useModelFiles } from '@/stores/modelFiles'
import { sceneOf, useScenes } from '@/stores/scenes'
import { AnimationCanvas } from './AnimationCanvas'
import { AnimationHeaders } from './Headers/AnimationHeaders'

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
  const expandedList = useAnimationViews(state => animationViewOf(state, documentId).expanded)
  const pickedBlock = useAnimationViews(state => animationViewOf(state, documentId).pickedBlock)
  const order = useAnimationViews(state => animationViewOf(state, documentId).order)

  useHeadInsideBand(documentId, timeline.duration)

  // Both memos are keyed on identities zustand keeps stable; building either inside a selector
  // would hand it a new snapshot every render and the subscription would never settle.
  const expanded = useMemo(() => keySetOf(expandedList), [expandedList])
  const lengths = useModelFiles(state => state.lengths[documentId])
  const rows = useMemo(() => {
    const byId = new Map(nodes.map(node => [node.id, node]))

    // A block's width comes from the ENGINE: the length of a clip lives in the GLB, and a model
    // still loading has none — it simply has no block yet rather than a block of no width.
    // Only for the models the band actually SHOWS. Built for every model of the scene, this loop
    // made a lane, a blocks array and an i18n call for each — and `animationRows` reads them only
    // for the objects on the sheet, so on 8 000 models with three on the band it threw 7 997 away.
    // The sheet, whoever holds a track, and whoever PLAYS a clip — exactly who `animationRows`
    // gives a line to. A model animated from elsewhere is on none of the first two, and building
    // no lane for it would leave its line empty where the whole point is to trim the block.
    const onBand = new Set([
      ...timeline.sheet,
      ...timeline.tracks.map(track => track.target.nodeId),
      ...nodes.flatMap(node =>
        node.type === 'model' && (node.model.lanes ?? []).some(lane => lane.clips.length > 0)
          ? node.id
          : [],
      ),
    ])

    const sheetLanes: SheetLane[] = []
    for (const node of byId.values()) {
      if (node.type !== 'model' || !onBand.has(node.id)) continue

      // A model on the band always shows a lane, empty or not: an object's track is where an
      // animation is dropped, and one appearing only once something plays can receive nothing.
      const lanes = node.model.lanes ?? [clipLane(MAIN_LANE_ID)]

      for (const [rank, lane] of lanes.entries()) {
        const blocks: ClipBlock[] = []

        for (const ref of lane.clips) {
          const seconds = lengths?.[node.id]?.[clipKeyOf(ref.source)] ?? null
          if (seconds === null) continue

          blocks.push({
            clipId: ref.id,
            name: clipRefLabel(ref, t),
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

    return animationRows(timeline, {
      nodes,
      expanded,
      lanes: sheetLanes,
      order,
      sceneName: t('animation.sceneSubject'),
    })
  }, [timeline, nodes, expanded, lengths, order, t])

  // The block whose settings stand beside the band, and what names them: one answer, read twice.
  const settled = playedBlockOf(nodes, pickedBlock)

  /**
   * The PANEL takes the drop, never the canvas: an empty band draws no canvas at all — the empty
   * state stands there — and that is the very moment a first object is dropped.
   */
  const onDropNodes = (event: DragEvent<HTMLDivElement>): void => {
    const nodeIds = sceneNodeDrag.idsFrom(event)
    if (nodeIds.length === 0) return

    event.preventDefault()
    const command = putOnAnimationSheet(sceneOf(useScenes.getState(), documentId), nodeIds)
    if (command) useScenes.getState().runCommand(documentId, command)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={event => {
        if (!sceneNodeDrag.carries(event)) return
        event.preventDefault()
        // The `+` under the pointer, which its channel allows — see `panels/scene/dragged`.
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={onDropNodes}
    >
      {rows.length === 0 ? (
        <EmptyState icon={mdiRhombus} message={t('animation.noTrack')} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <AnimationHeaders documentId={documentId} rows={rows} />
          <div className="min-w-0 flex-1">
            <AnimationCanvas documentId={documentId} rows={rows} />
          </div>
          {/* Beside the block one is looking at, and only then: mounted whatever was picked, it
              was 224 px of bordered nothing on every band holding no block — the skeleton
              window's own band holds none at all. */}
          {settled && (
            <aside
              aria-label={t('animation.blockSettings')}
              className="border-edge w-56 shrink-0 overflow-y-auto border-l"
            >
              {/* Named, and named after the BLOCK: unlabelled it was a column of controls with
                  nothing saying what they settled — « c'est quoi à droite de la timeline ». */}
              <PanelHeader title={clipRefLabel(settled.played, t)} />
              <div className="px-2 py-1">
                <TimelineClipSettings documentId={documentId} />
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
