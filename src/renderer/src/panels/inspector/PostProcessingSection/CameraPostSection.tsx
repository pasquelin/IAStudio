import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CAMERA_POST_MODES, type CameraPostMode } from '@shared/domain/postProcessing'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { SelectField } from '@/design/SelectField'
import { setCameraPostMode } from '@/engines/scene/postCommands'
import type { CameraNode } from '@/engines/scene/sceneState'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import { HINT_LEFT } from '@/helpers/tooltip'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { choicesOf } from '../unionChoices'

export type CameraPostSectionProps = {
  documentId: string
  camera: CameraNode
  edit: SceneEdit
}

/**
 * A section of its own rather than a row of the lens: what a camera FILMS THROUGH is not a lens
 * parameter, and the stack that follows would read as part of the same descriptor.
 */
export function CameraPostSection({ documentId, camera, edit }: CameraPostSectionProps) {
  const { t } = useTranslation()
  const modes = useMemo(() => choicesOf(CAMERA_POST_MODES, 'postfx.mode_', t), [t])
  const mode: CameraPostMode = camera.camera.post?.mode ?? 'inherit'

  return (
    <PropertySection title={t('postfx.cameraSection')} scId="postfx.camera">
      <SelectField
        label={t('postfx.mode')}
        scId="postfx.camera.mode"
        value={mode}
        options={modes.options}
        onChange={next =>
          // Read at call time rather than from a render: going to `override` SEEDS the camera
          // with the scene's stack as it stands NOW, not as it stood when the panel drew.
          edit.run(setCameraPostMode(sceneKeyingAt(documentId).state, camera.id, next))
        }
        hint={HINT_LEFT(modes.hintOf(mode))}
      />

      {mode === 'inherit' && <QuietNote>{t('postfx.inheriting')}</QuietNote>}
    </PropertySection>
  )
}
