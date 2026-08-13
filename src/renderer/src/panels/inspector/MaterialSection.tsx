import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialDescriptor } from '@shared/domain/scene'
import type { GestureProps } from '@/design/styles'
import { materialFields, withField } from '@/engines/scene/property-fields'
import { DescriptorSection } from './DescriptorSection'
import { TextureSlotFields } from './TextureSlotFields'

export type MaterialSectionProps = {
  material: MaterialDescriptor
  fallbackColor: string
  onChange: (material: MaterialDescriptor) => void
  gesture: GestureProps
}

/**
 * The material of a mesh: its colour and finish, then the maps that dress it — picked from the
 * project's own assets, which is the link between what the studio generates and what it makes.
 */
export function MaterialSection({
  material,
  fallbackColor,
  onChange,
  gesture,
}: MaterialSectionProps) {
  const { t } = useTranslation()
  const fields = useMemo(() => materialFields(material, fallbackColor), [material, fallbackColor])

  return (
    <DescriptorSection
      title={t('inspector.material')}
      fields={fields}
      onChange={(name, value) => onChange(withField(material, name, value))}
      gesture={gesture}
    >
      <TextureSlotFields
        slots={material}
        onChange={(slot, assetId) =>
          onChange({ ...material, [slot]: assetId === null ? null : { assetId } })
        }
      />
    </DescriptorSection>
  )
}
