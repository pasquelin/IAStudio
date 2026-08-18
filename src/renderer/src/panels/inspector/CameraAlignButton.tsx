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
 * Puts the camera where the view stands, looking where the view looks.
 *
 * The placement is asked of the ENGINE rather than read from the store: what the store publishes
 * lands once a drag settles, so a view nobody has moved since the tab opened holds nothing —
 * and this button would do nothing at all on the very framing one has just found.
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
