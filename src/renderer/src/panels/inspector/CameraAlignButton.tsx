import { mdiCameraControl } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { setTransform } from '@/engines/scene/commands'
import { transformFromPlacement } from '@/engines/scene/sceneView'
import type { CameraNode } from '@/engines/scene/sceneState'
import { TIP_LEFT } from '@/helpers/tooltip'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { useScenes } from '@/stores/scenes'

/**
 * Puts the camera where the view stands, looking where it looks. Asked of the ENGINE, not the
 * store: the store only publishes once a drag settles, so a view nobody moved holds nothing.
 */
export function CameraAlignButton({
  documentId,
  camera,
}: {
  documentId: string
  camera: CameraNode
}) {
  const { t } = useTranslation()

  return (
    <ToolButton
      icon={mdiCameraControl}
      label={t('inspector.alignCamera')}
      description={t('inspector.alignCameraHint')}
      tooltip={TIP_LEFT}
      variant="header"
      onClick={() => {
        const placement = sceneEngineOf(documentId)?.viewPlacement()
        if (!placement) return

        useScenes
          .getState()
          .runCommand(
            documentId,
            setTransform(camera.id, transformFromPlacement(placement, camera.transform)),
          )
      }}
    />
  )
}
