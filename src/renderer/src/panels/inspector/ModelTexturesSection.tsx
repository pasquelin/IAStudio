import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, posterUrl, type Asset } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { openAsset } from '@/helpers/open-asset'
import { TIP_LEFT } from '@/helpers/tooltip'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { Row } from '@/design/Row'
import { FIELD_THUMBNAIL, FOCUS_RING, rowSkin } from '@/design/styles'
import { Thumbnail } from '@/design/Thumbnail'

import { useDerivedTextures } from './useDerivedTextures'

export type ModelTexturesSectionProps = {
  /** The model's own asset — what the pictures on show were taken out of. */
  assetId: string
}

/**
 * The pictures an imported model carries, listed the way every other row of the studio is.
 *
 * What one comes to this panel to LOOK at: a model selected in the viewport shows its own maps,
 * and a double-click walks to the space that edits them. Where a map is swapped for a picture of
 * the project is a rarer errand, and reads as one — `ModelOverridesSection`, folded, underneath.
 */
export function ModelTexturesSection({ assetId }: ModelTexturesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelTextures')}>
      {/* Inside the section rather than around it: what is folded away is unmounted, so folding
          this one stops asking the catalogue as well as stops drawing it. */}
      <ModelTextureList assetId={assetId} />
    </PropertySection>
  )
}

function ModelTextureList({ assetId }: { assetId: string }) {
  const { t } = useTranslation()
  const textures = useDerivedTextures(assetId)

  // Said rather than left blank: extraction runs at import with nobody waiting on it, so an empty
  // list is as often "not yet" as "this file carries none".
  if (textures.length === 0) return <QuietNote>{t('inspector.noModelTexture')}</QuietNote>

  return (
    // No gap, as `Tree` draws the outliner right beside this panel: the studio spaces a row's
    // CONTENTS by two and stacks the rows themselves flush, which is what `spacing.test.ts`
    // holds. `Collection` reserves four pixels, but through its virtualizer rather than a class.
    <div className="flex flex-col">
      {textures.map(texture => (
        <ModelTextureRow key={texture.id} texture={texture} />
      ))}
    </div>
  )
}

/**
 * One picture of the model, named by the channel it plays and opened where it is edited.
 *
 * A row rather than a tile, and the difference is what the panel is FOR: a model wears seven or
 * eight maps, and squares two to a line put two of them on screen and sent the rest below the
 * fold. The picture stays — it is what one recognises a map by — at the gauge every other row of
 * the studio wears it.
 *
 * Memoised because the inspector re-renders on every frame of a gizmo drag (`SceneInspector`
 * says so at its own line), and a list of rows has no business in that budget.
 */
const ModelTextureRow = memo(function ModelTextureRow({ texture }: { texture: Asset }) {
  const { t } = useTranslation()
  // The channel over the file name: seven pictures called « Robot — … » differ by that word alone.
  // A slot the studio has no channel for keeps the name the extraction gave it.
  const channel = texture.map ? t(`texture.channel.${texture.map}`) : texture.name

  return (
    <div className={cn('relative', rowSkin(false))}>
      <Row
        // Straight off the row this list was answered with, rather than through `usePosterUrl`:
        // the asset is in hand, and it is fresher than the shelf, which is scoped by space.
        media={
          <Thumbnail url={posterUrl(texture) ?? assetUrl(texture.id)} className={FIELD_THUMBNAIL} />
        }
        // The channel alone, with no file name under it: the seven pictures of one model are all
        // called « Robot — … » and the word already on the line is the only one that tells them
        // apart. A subtitle here would be the same string seven times.
        title={channel}
      />

      {/* Laid OVER the row rather than around it, exactly as `ChannelTile` does and for the same
          reason: `Row` draws a `div` and a `p`, and a `button` takes phrasing content only. It
          covers the whole line, which is also what keeps the two tooltips of this row from
          answering different things — the pointer never reaches the name's own anchor. */}
      <button
        type="button"
        {...activation(() => void openAsset(texture))}
        {...TIP_LEFT(t('home.open', { name: channel }), false, t('inspector.openTextureHint'))}
        className={cn(
          'absolute inset-0 cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          FOCUS_RING,
        )}
      />
    </div>
  )
})
