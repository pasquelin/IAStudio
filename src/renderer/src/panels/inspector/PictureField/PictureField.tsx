import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PICTURES } from '@shared/domain/asset'
import { mountedAssetPicker } from '@/app/assetPicker'
import { LinkField, namedPress, type LinkFieldProps } from '@/design/LinkField/LinkField'
import { openAssetById } from '@/helpers/openAsset'
import { useContextMenu } from '@/hooks/useContextMenu'
import { useProjectPictures } from '@/hooks/useProjectPictures'
import { PictureFieldMenu } from './PictureFieldMenu'

export type PictureFieldProps = {
  label: string
  value: string | null
  onChange: (assetId: string | null) => void
  /**
   * What a double-click on the picture opens, when the asset's own space is not it. `null` for a
   * slot with NOTHING to open — told apart from an absent prop, which takes the default below.
   */
  open?: LinkFieldProps['open'] | null
  /**
   * What a single click on the picture does. Absent, it opens the picker — the same window the
   * browse button opens, put under the gesture a hand reaches for first.
   */
  press?: LinkFieldProps['press']
  /** A standing laid over the picture — see `LinkField`. */
  badge?: LinkFieldProps['badge']
  /** What a drop puts here, when the caller needs the asset itself — see `LinkField`. */
  onDropAsset?: LinkFieldProps['onDropAsset']
  /**
   * What the empty row reads. Given only where "empty" does not mean "no picture": a model's slot
   * left empty wears the map its own file carries, and reading « none » over a textured model
   * would be a plain lie. `null` for a slot that CANNOT be empty — see `LinkField`.
   */
  emptyLabel?: string | null
  /** The handle the MCP steers this link by. Never a translated word. */
  scId?: string
  /**
   * Menu rows belonging to the SURFACE rather than to the slot — see `PictureFieldMenu`. Handed
   * the closer, since a row is what shuts the menu it was chosen in.
   */
  menuExtra?: (close: () => void) => ReactNode
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
  press,
  badge,
  onDropAsset,
  emptyLabel,
  scId,
  menuExtra,
}: PictureFieldProps) {
  const { t } = useTranslation()
  const options = useProjectPictures(PICTURES)
  const menu = useContextMenu()
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

  const opening =
    open === null
      ? undefined
      : (open ?? {
          label: t('inspector.openTexture'),
          hint: t('inspector.openTextureHint'),
          run: () => openAssetById(value),
        })

  return (
    <div className="min-w-0" onContextMenu={menu.open}>
      <LinkField
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        emptyLabel={emptyLabel === null ? undefined : (emptyLabel ?? t('inspector.noTexture'))}
        missingLabel={t('inspector.missingTexture')}
        clearLabel={t('inspector.clearTexture')}
        // The three kinds that decode as an image, which is exactly what `options` was filtered to:
        // a slot that lit up for a mesh would promise a drop it then refuses.
        accepts={PICTURES}
        badge={badge}
        onDropAsset={onDropAsset}
        press={
          press ?? {
            label: t('inspector.pickPicture'),
            hint: t('inspector.pickPictureHint'),
            run: browse,
          }
        }
        open={opening}
        browse={{
          label: t('inspector.browseTexture'),
          hint: t('inspector.browseTextureHint'),
          run: browse,
        }}
        scId={scId}
      />

      {menu.at && (
        <PictureFieldMenu
          at={menu.at}
          onClose={menu.close}
          onBrowse={browse}
          // Only what the slot RESOLVED to can be opened, as the press is: a document outlives the
          // picture it points at.
          open={value === null ? undefined : namedPress(opening)}
          onClear={emptyLabel === null || value === null ? undefined : () => onChange(null)}
          extra={menuExtra?.(menu.close)}
        />
      )}
    </div>
  )
}
