import { mdiVideoPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { addCameraShot } from '@/engines/scene/animationCommands'
import { newShotAt } from '@/engines/scene/cameraShots'
import { selectedNodes } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

/** Puts the selected camera on air from the head onwards — the shot itself is `newShotAt`'s. */
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
        store.runCommand(
          documentId,
          addCameraShot(newShotAt(animation, camera.id, newId(), playhead)),
        )
      }}
    />
  )
}
