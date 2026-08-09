import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { Button } from '@/design/Button'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { Section } from '../Section'
import { SectionNote } from '../SectionNote'
import { ShelfTile, SHELF_TILE_SIZE } from '../ShelfCard'
import { useDeferredShelf } from '../use-shelf'

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
 * What the band knows, which is more than "some assets or none".
 *
 * A refusal and an account with nothing alike used to look the same from here: both arrived as
 * an empty shelf, and the band took itself off the page until the key changed. They are told
 * apart because only one of them is worth offering to try again.
 */
type Lookalikes =
  /** Not read yet, or nothing to draw — nothing to measure against, or nothing that resembles it. */
  | { state: 'silent' }
  | { state: 'refused' }
  | { state: 'ready'; reference: CloudAsset; assets: readonly CloudAsset[] }

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
  // Part of what the shelf reads under, so pressing "try again" is a new read rather than a
  // second copy of the fetch that `useShelf` already owns.
  const [attempt, setAttempt] = useState(0)
  // Two requests, both below the fold on any window: spent when the band is reached.
  const { value: page, ref } = useDeferredShelf<Lookalikes>(
    { state: 'silent' },
    lookalikes,
    `${owner}/${attempt}`,
  )

  if (page.state === 'silent') return <div ref={ref} aria-hidden />

  if (page.state === 'refused') {
    return (
      <Section
        id="similar"
        title={t('home.sections.similar')}
        actions={<Button onClick={() => setAttempt(count => count + 1)}>{t('home.retry')}</Button>}
      >
        <SectionNote>{t('home.similar.refused')}</SectionNote>
      </Section>
    )
  }

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
 * Two reads, and the failure of either is a refusal rather than an empty band.
 *
 * `useShelf` turns a rejection into the initial value, which is exactly the confusion this type
 * exists to end — so the catch is here, where what failed is still known.
 */
async function lookalikes(): Promise<Lookalikes> {
  const bridge = getBridge()
  if (!bridge) return { state: 'silent' }

  try {
    const library = await bridge.cloud.browse({ pageSize: REFERENCE_CANDIDATES })
    const reference = library.assets[0]
    if (!reference) return { state: 'silent' }

    const assets = await bridge.cloud.similar(reference.id)
    // Settled here rather than at the render: "ready" then means there is something to draw,
    // and the band has one way of saying nothing instead of two.
    return assets.length === 0 ? { state: 'silent' } : { state: 'ready', reference, assets }
  } catch {
    return { state: 'refused' }
  }
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
