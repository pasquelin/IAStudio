import { mdiTextureBox } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { ModelRef } from '@shared/domain/scene'
import { cn } from '@/helpers/cn'
import { openAsset } from '@/helpers/open-asset'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useDerivedTextures } from '@/hooks/useDerivedTextures'
import { usePosterUrl } from '@/hooks/usePosterUrl'
import { MediaTile } from '@/design/MediaTile'
import { PropertySection } from '@/design/PropertySection'
import { FOCUS_RING } from '@/design/styles'

import { TextureSlotFields } from './TextureSlotFields'

export type ModelTexturesSectionProps = {
  /** The model's own asset — what the pictures on show were taken out of. */
  assetId: string
  textures: ModelRef['textures']
  onChange: (textures: ModelRef['textures']) => void
}

/**
 * The pictures an imported model carries, and — folded under them — the slots where a picture of
 * the project can be put over one.
 *
 * The grid comes first because it is what one comes here to LOOK at: a model selected in the
 * viewport shows its own maps, and a double-click walks to the one that edits them. The five
 * fields point somewhere else, which is a rarer errand and reads as one folded away.
 *
 * A section of its own rather than the mesh's `MaterialSection`: a model's file already carries a
 * colour and a finish per material, and the studio has no business restating either — what it
 * offers here is the one thing extracting a texture then editing it is FOR.
 */
export function ModelTexturesSection({ assetId, textures, onChange }: ModelTexturesSectionProps) {
  const { t } = useTranslation()
  const own = useDerivedTextures(assetId)

  return (
    <>
      <PropertySection title={t('inspector.modelTextures')}>
        {own.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {own.map(texture => (
              <ModelTextureTile key={texture.id} texture={texture} />
            ))}
          </div>
        ) : (
          // Said rather than left blank: extraction runs at import with nobody waiting on it, so
          // an empty grid is as often "not yet" as "this file carries none".
          <p className="text-muted text-tiny m-0">{t('inspector.noModelTexture')}</p>
        )}
      </PropertySection>

      <PropertySection title={t('inspector.modelOverrides')} defaultOpen={false}>
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
    </>
  )
}

/** One picture of the model, captioned by the channel it plays and opened where it is edited. */
function ModelTextureTile({ texture }: { texture: Asset }) {
  const { t } = useTranslation()
  const poster = usePosterUrl(texture.id)
  // The channel over the file name: seven pictures called « Robot — … » differ by that word alone.
  // A slot the studio has no channel for keeps the name the extraction gave it.
  const caption = texture.map ? t(`texture.channel.${texture.map}`) : texture.name
  const open = (): void => void openAsset(texture)

  return (
    <div className="relative">
      <MediaTile url={poster} caption={caption} fallbackIcon={mdiTextureBox} />

      {/* Laid over the tile rather than wrapped around it, as a channel tile is: `MediaTile`
          renders a `figure`, and a `button` takes phrasing content only. */}
      <button
        type="button"
        {...TIP_LEFT(
          t('inspector.openTexture', { name: caption }),
          false,
          t('inspector.openTextureHint'),
        )}
        // The double-click opens an asset everywhere in the studio — the shelf, the explorer, the
        // library — and Enter is what the keyboard has instead of it, exactly as `Collection` has
        // them. A single click is left doing nothing: this grid picks nothing.
        onDoubleClick={open}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          open()
        }}
        className={cn(
          'absolute inset-0 cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          FOCUS_RING,
        )}
      />
    </div>
  )
}
