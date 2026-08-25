import { useTranslation } from 'react-i18next'
import type { ModelRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'

import { TextureSlotFields } from '../TextureSlotFields'
import { ModelOverridesSectionOwnPictures } from './ModelOverridesSectionOwnPictures'

export type ModelOverridesSectionProps = {
  /** The model's own asset — what the pictures offered at the foot were taken out of. */
  assetId: string
  textures: ModelRef['textures']
  onChange: (textures: ModelRef['textures']) => void
}

/**
 * The maps of an imported model, swapped for pictures of the project.
 *
 * A section of its own rather than the mesh's `MaterialSection`: a model's file already carries a
 * colour and a finish per material, and the studio has no business restating either — what it
 * offers here is a slot for a picture that was edited elsewhere to land back on.
 *
 * Folded on sight, under the model's own pictures: pointing a slot somewhere else is the rarer
 * half of this panel, and the file's own maps are what one opens it to see.
 */
export function ModelOverridesSection({ assetId, textures, onChange }: ModelOverridesSectionProps) {
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
      <ModelOverridesSectionOwnPictures
        assetId={assetId}
        textures={textures}
        label={t('inspector.useModelPictures')}
        hint={t('inspector.useModelPicturesHint')}
        onChange={onChange}
      />
    </PropertySection>
  )
}
