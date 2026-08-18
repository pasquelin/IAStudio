import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { ClipLane } from '@shared/domain/scene'
import { setModelLanes } from '@/engines/scene/commands'
import { lanesWith } from '@/engines/scene/clipBlend'
import { SliderField } from '../SliderField'
import { ToggleField } from '../ToggleField'
import { ToolButton } from '../ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

export type AnimationPickerPreviewProps = {
  documentId: string
  nodeId: string
  clipId: string
}

/** How fast a clip may be asked to run — the same bounds the inspector holds it to. */
const MIN_SPEED = 0.1
const MAX_SPEED = 4

/** One identity for « this model plays nothing », so the subscription can settle. */
const NO_LANES: readonly ClipLane[] = []

/**
 * Play, restart, speed and loop, on the block that was just laid.
 *
 * It plays the REAL block through the real retargeting, on the real character: what the issue
 * asks in as many words. There is nothing to rehearse and nothing that could differ.
 */
export function AnimationPickerPreview({
  documentId,
  nodeId,
  clipId,
}: AnimationPickerPreviewProps) {
  const { t } = useTranslation()
  const preview = useSceneViews(state => sceneViewOf(state, documentId).preview)
  const lanes = useScenes(state => {
    const node = sceneOf(state, documentId).nodes.find(one => one.id === nodeId)
    // NO_LANES and never a fresh `[]`: a selector handing zustand a new array on every render
    // is a subscription that never settles, and React stops at the update limit.
    return node?.type === 'model' ? (node.model.lanes ?? NO_LANES) : NO_LANES
  })

  const lane = lanes.find(one => one.clips.some(clip => clip.id === clipId))
  const played = lane?.clips.find(clip => clip.id === clipId)
  if (!lane || !played) return null

  const running = preview?.clipId === clipId

  const write = (speed: number, loop: boolean): void => {
    const next = lanesWith(lanes, lane.id, clips =>
      clips.map(clip => (clip.id === clipId ? { ...clip, speed, loop } : clip)),
    )
    if (next) useScenes.getState().runCommand(documentId, setModelLanes(nodeId, next))
  }

  const watch = (on: boolean): void =>
    useSceneViews.getState().setPreview(documentId, on ? { nodeId, clipId } : null)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ToolButton
          icon={mdiSkipPrevious}
          label={t('inspector.animationRestart')}
          tooltip={TIP_BOTTOM}
          onClick={() => {
            watch(false)
            watch(true)
          }}
        />
        <ToolButton
          icon={running ? mdiPause : mdiPlay}
          label={t(running ? 'inspector.animationPause' : 'inspector.animationPlay')}
          tooltip={TIP_BOTTOM}
          active={running}
          onClick={() => watch(!running)}
        />
      </div>
      <SliderField
        label={t('inspector.clipSpeed')}
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={0.1}
        value={played.speed}
        onChange={speed => write(speed, played.loop)}
      />
      <ToggleField
        label={t('inspector.clipLoop')}
        value={played.loop}
        onChange={loop => write(played.speed, loop)}
      />
    </div>
  )
}
