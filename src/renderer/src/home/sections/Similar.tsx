import { useTranslation } from 'react-i18next'
import { cloudPreviewUrl, type CloudAsset, type SimilarPage } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { Section } from '../Section'
import { ShelfTile, SHELF_TILE_SIZE } from '../ShelfCard'
import { useShelf } from '../use-shelf'

/**
 * Published work in the vein of this account's latest asset.
 *
 * The likeness is the API's own — visual and semantic at once — and the reference is picked
 * rather than chosen: a picker here would be a second asset browser on a page that already has
 * one. The heading names what the likeness was measured against, so the shelf is never a row of
 * pictures with no stated reason to be there.
 *
 * Inert, like the explore feed: these belong to other people.
 */
export function Similar() {
  const { t } = useTranslation()
  const owner = useSettings(activeOwnerId)

  const page = useShelf<SimilarPage | null>(null, () => getBridge()?.cloud.similar(), `${owner}`)

  // Nothing to measure a likeness against, or nothing that resembles it: either way there is no
  // shelf to draw, and no incident to report.
  if (!page || page.assets.length === 0) return null

  return (
    <Section id="similar" title={t('home.similar.title', { name: page.reference.name })}>
      <Carousel
        items={page.assets}
        itemWidth={SHELF_TILE_SIZE}
        itemHeight={SHELF_TILE_SIZE}
        label={t('home.sections.similar')}
        renderCard={asset => <Tile asset={asset} />}
      />
    </Section>
  )
}

function Tile({ asset }: { asset: CloudAsset }) {
  const { t } = useTranslation()

  return (
    <ShelfTile
      url={cloudPreviewUrl(asset, { width: FAVORITE_THUMBNAIL_WIDTH }) ?? undefined}
      caption={asset.generation?.modelLabel || asset.name}
      fallbackIcon={assetIcon(asset.type)}
      hint={asset.name}
      label={t('home.sections.similar')}
    />
  )
}
