import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, isLocalPicture } from '@shared/domain/asset'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { useAssets } from '@/stores/assets'

export type PictureFieldProps = {
  label: string
  value: string | null
  onChange: (assetId: string | null) => void
}

/**
 * A slot filled from the project's own pictures — the link between what the studio generates and
 * what it dresses. One component rather than one per section, so a mesh's five maps and a
 * sprite's one never disagree on what counts as a picture, or on what the empty row reads.
 */
export function PictureField({ label, value, onChange }: PictureFieldProps) {
  const { t } = useTranslation()
  const assets = useAssets(state => state.items)

  const options = useMemo<TextureOption[]>(
    () =>
      assets.filter(isLocalPicture).map(asset => ({
        id: asset.id,
        name: asset.name,
        url: assetUrl(asset.id, asset.localChangedAt),
      })),
    [assets],
  )

  return (
    <TextureField
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel={t('inspector.noTexture')}
      chooseLabel={t('inspector.chooseTexture')}
      clearLabel={t('inspector.clearTexture')}
      emptyHint={t('inspector.noTextureHint')}
      optionHint={t('inspector.pickTextureHint')}
    />
  )
}
