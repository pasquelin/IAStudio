import { useTranslation } from 'react-i18next'
import type { ModelRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'

import { TextureSlotFields } from '../TextureSlotFields'
import { ModelOverridesSectionFinish } from './ModelOverridesSectionFinish'

export type ModelOverridesSectionProps = {
  /** The model's own asset — what the pictures offered at the foot were taken out of. */
  assetId: string
  textures: ModelRef['textures']
  onChange: (textures: ModelRef['textures']) => void
  /** The finish it wears over its file — its own command, and its own undo step. */
  onFinish: (material: ModelRef['material']) => void
}

/**
 * The maps of an imported model, swapped for pictures of the project.
 *
 * A section of its own rather than the mesh's `MaterialSection`: a model's file already carries a
 * colour and a finish per material, and the studio has no business restating either — what it
 * offers here is a slot for a picture that was edited elsewhere to land back on.
 *
 * Folded on sight: pointing a slot somewhere else is the rarer half of this panel, and a model
 * already wears the pictures its own file shed — `effectiveModelTextures` fills every slot left
 * empty here, so there is nothing to press to get them.
 */
export function ModelOverridesSection({
  assetId,
  textures,
  onChange,
  onFinish,
}: ModelOverridesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection
      title={t('inspector.modelOverrides')}
      defaultOpen={false}
      scId="modelOverrides"
    >
      <TextureSlotFields
        slots={textures ?? {}}
        emptyLabel={t('inspector.fileTexture')}
        scId="modelOverrides"
        onChange={(slot, pictureId) => {
          const rest = { ...textures }
          delete rest[slot]
          onChange(pictureId === null ? rest : { ...rest, [slot]: { assetId: pictureId } })
        }}
      />
      <ModelOverridesSectionFinish
        assetId={assetId}
        label={t('inspector.useModelFinish')}
        hint={t('inspector.useModelFinishHint')}
        onChange={onFinish}
      />
    </PropertySection>
  )
}
