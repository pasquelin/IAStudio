import { useTranslation } from 'react-i18next'
import type { ModelRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'

import { TextureSlotFields } from './TextureSlotFields'

export type ModelTexturesSectionProps = {
  textures: ModelRef['textures']
  onChange: (textures: ModelRef['textures']) => void
}

/**
 * The maps of an imported model, swapped for pictures of the project.
 *
 * A section of its own rather than the mesh's `MaterialSection`: a model's file already carries a
 * colour and a finish per material, and the studio has no business restating either — what it
 * offers here is the one thing extracting a texture then editing it is FOR.
 */
export function ModelTexturesSection({ textures, onChange }: ModelTexturesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelTextures')}>
      <TextureSlotFields
        slots={textures ?? {}}
        emptyLabel={t('inspector.fileTexture')}
        emptyHint={t('inspector.fileTextureHint')}
        onChange={(slot, assetId) => {
          const rest = { ...textures }
          delete rest[slot]
          onChange(assetId === null ? rest : { ...rest, [slot]: { assetId } })
        }}
      />
    </PropertySection>
  )
}
