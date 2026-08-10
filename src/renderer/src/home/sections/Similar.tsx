import { useTranslation } from 'react-i18next'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { RefusedSection } from '../RefusedSection'
import { Section } from '../Section'
import { ShelfTile, SHELF_TILE_SIZE } from '@/design/ShelfTile'
import { useDeferredShelf } from '@/hooks/use-shelf'

/**
 * How many of the newest assets are looked at to find one to measure against.
 *
 * Never one. The library holds records that are data ABOUT an asset rather than an asset — a
 * captioning job writes JSON, and the studio makes those itself on every pull — and the catalogue
 * drops them on the way through. A single one at the head of `GET /assets` left the reference
 * empty and took the whole band off an account holding thousands.
 */
const REFERENCE_CANDIDATES = 10

/**
 * What the band draws, when it has something to draw.
 *
 * `null` is "nothing to measure against, or nothing that resembles it" — an ordinary answer,
 * and not the same thing as a refusal, which `useShelf` now reports on its own.
 */
type Lookalikes = { reference: CloudAsset; assets: readonly CloudAsset[] } | null

/**
 * Published work in the vein of this account's latest asset.
 *
 * The likeness is the API's own — visual and semantic at once. WHICH asset it is measured
 * against is decided here and not in the main process: it is a choice this band makes, and the
 * channel it calls answers for any asset one names.
 *
 * Inert, like the explore feed: these belong to other people.
 */
export function Similar() {
  const { t } = useTranslation()
  const owner = useSettings(activeOwnerId)
  // Two requests, both below the fold on any window: spent when the band is reached.
  const {
    value: page,
    state,
    retry,
    marker,
  } = useDeferredShelf<Lookalikes>(null, lookalikes, `${owner}`)

  if (state === 'refused')
    return <RefusedSection id="similar" message={t('home.similar.refused')} onRetry={retry} />

  if (!page) return marker

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

/**
 * Two reads, and the failure of either is a refusal — which is `useShelf`'s to report now, so
 * this one lets it through instead of catching it into a state of its own.
 */
async function lookalikes(): Promise<Lookalikes> {
  const bridge = getBridge()
  if (!bridge) return null

  const library = await bridge.cloud.browse({ pageSize: REFERENCE_CANDIDATES })
  const reference = library.assets[0]
  if (!reference) return null

  const assets = await bridge.cloud.similar(reference.id)
  // Settled here rather than at the render: a page then means there is something to draw, and
  // the band has one way of saying nothing instead of two.
  return assets.length === 0 ? null : { reference, assets }
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
