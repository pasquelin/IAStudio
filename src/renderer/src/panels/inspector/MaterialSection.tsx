import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, type Asset, type AssetType } from '@shared/domain/asset'
import { TEXTURE_SLOTS, type MaterialDescriptor } from '@shared/domain/scene'
import { PropertySection } from '@/design/PropertySection'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { materialFields, withField } from '@/engines/scene/property-fields'
import { useAssets } from '@/stores/assets'
import { PropertyControl } from './PropertyControl'
import type { Gesture } from './useSceneEdit'

export type MaterialSectionProps = {
  material: MaterialDescriptor
  fallbackColor: string
  onChange: (material: MaterialDescriptor) => void
  gesture: Gesture
}

/**
 * Which kinds of asset a texture slot can actually be filled with. The pictures of the project,
 * whatever folder they were filed under — what the studio generates lands in `image` far more
 * often than in `texture`, and a picker that only listed one of them would be empty on a real
 * project. Video, audio and meshes are left out: they would fail to load.
 */
const USABLE: readonly AssetType[] = ['texture', 'image', 'skybox']

function isUsable(asset: Asset): boolean {
  return USABLE.includes(asset.type) && asset.location === 'local' && asset.path !== undefined
}

/**
 * The material of a mesh: its colour and finish, then the maps that dress it. The textures are
 * the link between what the application generates and what can be done with it — so they are
 * picked from the project's own assets, and what is stored is the reference, never the image.
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
        .filter(isUsable)
        .map(asset => ({ id: asset.id, name: asset.name, url: assetUrl(asset.id) })),
    [assets],
  )

  return (
    <PropertySection title={t('inspector.material')}>
      {materialFields(material, fallbackColor).map(field => (
        <PropertyControl
          key={field.name}
          field={field}
          label={t(`inspector.fields.${field.name}`, field.name)}
          onChange={value => onChange(withField(material, field.name, value))}
          gesture={gesture}
        />
      ))}

      {TEXTURE_SLOTS.map(slot => (
        <TextureField
          key={slot}
          label={t(`inspector.fields.${slot}`)}
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
    </PropertySection>
  )
}
