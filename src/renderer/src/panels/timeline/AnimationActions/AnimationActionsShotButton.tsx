import { mdiVideoPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { frameDuration, SECOND, snapToFrame, type Us } from '@shared/domain/time'
import { ToolButton } from '@/design/ToolButton'
import { addCameraShot } from '@/engines/scene/animationCommands'
import { selectedNodes } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

/** How long a shot lasts when nothing says otherwise: what is left of the band, at most this. */
const DEFAULT_SHOT: Us = 3 * SECOND

/**
 * Puts the selected camera on air from the head onwards.
 *
 * The layer is one above the highest already there, so a shot laid over another wins straight
 * away — laying one down to have it hidden by what was already on the band would read as a
 * button that did nothing.
 */
export function AnimationActionsShotButton({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)

  const anchor = selectedNodes(nodes, selectedIds).at(-1) ?? null
  const camera = anchor?.type === 'camera' ? anchor : null

  return (
    <ToolButton
      icon={mdiVideoPlusOutline}
      label={t('animation.addShot')}
      description={camera ? t('animation.addShotHint') : t('animation.addShotNeedsCamera')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={!camera}
      onClick={() => {
        if (!camera) return

        const store = useScenes.getState()
        const { animation } = sceneOf(store, documentId)
        const start = snapToFrame(Math.min(playhead, animation.duration), animation.fps)
        const layers = animation.shots.map(shot => shot.layer)

        store.runCommand(
          documentId,
          addCameraShot({
            id: newId(),
            cameraId: camera.id,
            layer: layers.length === 0 ? 0 : Math.max(...layers) + 1,
            start,
            // A frame at least: pressed with the head on the last frame, a shot of what is left
            // of the band would have no length at all, and no bar to grab it back by.
            duration: Math.max(
              frameDuration(animation.fps),
              Math.min(DEFAULT_SHOT, animation.duration - start),
            ),
          }),
        )
      }}
    />
  )
}
