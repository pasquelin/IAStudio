import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isLocalPicture, PICTURES, posterUrl } from '@shared/domain/asset'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { openAssetById } from '@/helpers/open-asset'
import { useAssets } from '@/stores/assets'

export type PictureFieldProps = {
  label: string
  value: string | null
  onChange: (assetId: string | null) => void
  /**
   * What the empty row reads, and what its hint explains — both already translated. Given only
   * where "empty" does not mean "no picture": a model's slot left empty wears the map its own file
   * carries, and reading « none » over a textured model would be a plain lie. The hint travels
   * with the label because it says the same thing at more length, and one without the other is
   * the very lie the label was overridden to avoid.
   */
  emptyLabel?: string
  emptyHint?: string
}

/**
 * A slot filled from the project's own pictures — the link between what the studio generates and
 * what it dresses. One component rather than one per section, so a mesh's five maps and a
 * sprite's one never disagree on what counts as a picture, or on what the empty row reads.
 */
export function PictureField({ label, value, onChange, emptyLabel, emptyHint }: PictureFieldProps) {
  const { t } = useTranslation()
  const assets = useAssets(state => state.items)

  const options = useMemo<TextureOption[]>(
    () =>
      assets
        .filter(isLocalPicture)
        .map(asset => ({ id: asset.id, name: asset.name, url: posterUrl(asset) ?? undefined })),
    [assets],
  )

  return (
    <TextureField
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel={emptyLabel ?? t('inspector.noTexture')}
      // Named after the slot, because the whole LINE is what opens the menu now: five slots of a
      // material offered five controls called « Choose a texture », so nothing said which channel
      // one was about to change — to a screen reader stepping through them, or to a voice command
      // naming the one on screen. It is also the only place the slot's name stays readable when
      // the column truncates it, which `Row` used to answer with a native title the cover swallows.
      chooseLabel={t('inspector.chooseTextureFor', { name: label })}
      clearLabel={t('inspector.clearTexture')}
      emptyHint={emptyHint ?? t('inspector.noTextureHint')}
      optionHint={t('inspector.pickTextureHint')}
      // The three kinds that decode as an image, which is exactly what `options` was filtered to:
      // a slot that lit up for a mesh would promise a drop it then refuses.
      accepts={PICTURES}
      open={{
        label: t('inspector.openTexture'),
        hint: t('inspector.openTextureHint'),
        run: () => openAssetById(value),
      }}
    />
  )
}
