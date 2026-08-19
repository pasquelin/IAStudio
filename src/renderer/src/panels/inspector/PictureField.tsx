import { useTranslation } from 'react-i18next'
import { PICTURES } from '@shared/domain/asset'
import { mountedAssetPicker } from '@/app/assetPicker'
import { LinkField, type LinkFieldProps } from '@/design/LinkField/LinkField'
import { openAssetById } from '@/helpers/openAsset'
import { useProjectPictures } from '@/hooks/useProjectPictures'

export type PictureFieldProps = {
  label: string
  value: string | null
  onChange: (assetId: string | null) => void
  /** What pressing the picture does, when it is not opening the asset — see `LinkField`. */
  open?: LinkFieldProps['open']
  /** A standing laid over the picture — see `LinkField`. */
  badge?: LinkFieldProps['badge']
  /** What a drop puts here, when the caller needs the asset itself — see `LinkField`. */
  onDropAsset?: LinkFieldProps['onDropAsset']
  /**
   * What the empty row reads. Given only where "empty" does not mean "no picture": a model's slot
   * left empty wears the map its own file carries, and reading « none » over a textured model
   * would be a plain lie.
   */
  emptyLabel?: string
  /** The handle the MCP steers this link by. Never a translated word. */
  scId?: string
}

/**
 * A slot filled from the project's own pictures — the link between what the studio generates and
 * what it dresses. One component rather than one per section, so a mesh's five maps and a
 * sprite's one never disagree on what counts as a picture, or on what the empty row reads.
 */
export function PictureField({
  label,
  value,
  onChange,
  open,
  badge,
  onDropAsset,
  emptyLabel,
  scId,
}: PictureFieldProps) {
  const { t } = useTranslation()
  const options = useProjectPictures(PICTURES)
  /**
   * Asked for at press time, never at render: the window is mounted by the shell, and a slot that
   * captured it while drawing would hold whatever was mounted when the panel first opened.
   */
  const browse = (): void => {
    const picker = mountedAssetPicker()
    if (!picker) return

    void picker({ accepts: PICTURES, label }).then(chosen => {
      // `null` is the window being called off, which is not the same as choosing nothing — that
      // is what the empty entry of the list is for.
      if (chosen !== null) onChange(chosen)
    })
  }

  return (
    <LinkField
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      emptyLabel={emptyLabel ?? t('inspector.noTexture')}
      missingLabel={t('inspector.missingTexture')}
      clearLabel={t('inspector.clearTexture')}
      // The three kinds that decode as an image, which is exactly what `options` was filtered to:
      // a slot that lit up for a mesh would promise a drop it then refuses.
      accepts={PICTURES}
      badge={badge}
      onDropAsset={onDropAsset}
      open={
        open ?? {
          label: t('inspector.openTexture'),
          hint: t('inspector.openTextureHint'),
          run: () => openAssetById(value),
        }
      }
      browse={{
        label: t('inspector.browseTexture'),
        hint: t('inspector.browseTextureHint'),
        run: browse,
      }}
      scId={scId}
    />
  )
}
