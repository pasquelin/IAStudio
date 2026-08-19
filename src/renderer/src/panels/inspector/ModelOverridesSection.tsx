import { useTranslation } from 'react-i18next'
import type { ModelRef } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'

import { TextureSlotFields } from './TextureSlotFields'

export type ModelOverridesSectionProps = {
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
export function ModelOverridesSection({ textures, onChange }: ModelOverridesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelOverrides')} defaultOpen={false}>
      <TextureSlotFields
        slots={textures ?? {}}
        emptyLabel={t('inspector.fileTexture')}
        scId="modelOverrides"
        onChange={(slot, assetId) => {
          const rest = { ...textures }
          delete rest[slot]
          onChange(assetId === null ? rest : { ...rest, [slot]: { assetId } })
        }}
      />
    </PropertySection>
  )
}
