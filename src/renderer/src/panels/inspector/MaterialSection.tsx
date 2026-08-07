import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, isLocalPicture } from '@shared/domain/asset'
import { TEXTURE_SLOTS, type MaterialDescriptor } from '@shared/domain/scene'
import type { GestureProps } from '@/design/styles'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { materialFields, withField } from '@/engines/scene/property-fields'
import { useAssets } from '@/stores/assets'
import { DescriptorSection } from './DescriptorSection'

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
  const assets = useAssets(state => state.items)

  const options = useMemo<TextureOption[]>(
    () =>
      assets
        .filter(isLocalPicture)
        .map(asset => ({ id: asset.id, name: asset.name, url: assetUrl(asset.id) })),
    [assets],
  )

  const fields = useMemo(() => materialFields(material, fallbackColor), [material, fallbackColor])

  return (
    <DescriptorSection
      title={t('inspector.material')}
      fields={fields}
      onChange={(name, value) => onChange(withField(material, name, value))}
      gesture={gesture}
    >
      {TEXTURE_SLOTS.map(slot => (
        <TextureField
          key={slot}
          label={t(`inspector.fields.${slot}`, slot)}
          value={material[slot]?.assetId ?? null}
          options={options}
          onChange={assetId =>
            onChange({ ...material, [slot]: assetId === null ? null : { assetId } })
          }
          emptyLabel={t('inspector.noTexture')}
          chooseLabel={t('inspector.chooseTexture')}
          clearLabel={t('inspector.clearTexture')}
        />
      ))}
    </DescriptorSection>
  )
}
