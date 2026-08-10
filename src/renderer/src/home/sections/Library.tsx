import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { RefusedSection } from '../RefusedSection'
import { Section } from '../Section'
import { openFromHome } from '../open'
import { ShelfTile, SHELF_TILE_SIZE } from '../ShelfCard'
import { useShelf } from '../use-shelf'

const NOTHING: readonly CloudAsset[] = []

/** The CDN resizes; a 4K down the wire to draw a 132 px tile does not. Same width a pin keeps. */
const PREVIEW_WIDTH = FAVORITE_THUMBNAIL_WIDTH

/**
 * The library the API key opens onto, which is not this project's catalogue.
 *
 * Nothing here is stored: the assets are read through on every visit, and the URL that draws a
 * tile is signed and expires. Keeping one would mean a home that shows broken pictures a
 * fortnight later, with nothing to say why — hence a fresh page each time rather than a cache.
 */
export function Library() {
  const { t } = useTranslation()
  const owner = useSettings(activeOwnerId)
  const sections = useSettings(state => state.settings.home.sections)
  const limit = homeSectionLimit(sections, 'library')

  // Read again when the active key changes: another key is another library, and the tiles of the
  // previous one would be pictures nobody in this account can fetch.
  const { value: page, state, retry } = useShelf(NOTHING, () => browse(limit), `${owner}/${limit}`)

  // Which of these the project already holds, keyed by the id the library knows them under.
  // Built once for the band rather than searched per tile: `find` over the whole catalogue in
  // each of twelve cards would be twelve walks of it on every render.
  const items = useAssets(shelf => shelf.items)
  const fetchedById = useMemo(() => {
    const found = new Map<string, Asset>()
    for (const item of items) if (item.remoteAssetId) found.set(item.remoteAssetId, item)
    return found
  }, [items])

  // A 429 used to take the band off the page without a word — and since `cloudBrowse` goes
  // through `quietlyReducedBy`, the journal did not say it either.
  if (state === 'refused') return <RefusedSection id="library" onRetry={retry} />

  if (page.length === 0) return null

  return (
    <Section id="library" title={t('home.sections.library')}>
      <Carousel
        items={page}
        itemWidth={SHELF_TILE_SIZE}
        itemHeight={SHELF_TILE_SIZE}
        label={t('home.sections.library')}
        renderCard={asset => <Tile asset={asset} fetched={fetchedById.get(asset.id)} />}
      />
    </Section>
  )
}

function browse(limit: number | undefined): Promise<CloudAsset[]> | undefined {
  return getBridge()
    ?.cloud.browse({ pageSize: limit })
    .then(page => page.assets)
}

/**
 * One asset of the library, and what a click on it does depends on one thing: whether it is on
 * the disk yet.
 *
 * Already fetched, it opens — the rule the whole home now follows. Not fetched, there is nothing
 * to open, so fetching stays the main action on those tiles and only those. Implicit fetching
 * was ruled out: a click that quietly downloads is the surprise this entry exists to end.
 *
 * It stands as a plain picture with no project: the section says what the account holds, and
 * that is worth showing before a project is open — but nothing here may act without a folder.
 */
function Tile({ asset, fetched }: { asset: CloudAsset; fetched: Asset | undefined }) {
  const { t } = useTranslation()
  const hasProject = useProject(state => state.project !== null)
  const busy = useCloud(state => state.busy)

  const act = fetched
    ? { label: t('home.open', { name: asset.name }), run: () => openFromHome(fetched) }
    : hasProject && !busy
      ? {
          label: t('home.library.fetch', { name: asset.name }),
          run: () => void useCloud.getState().pull([asset.id]),
        }
      : null

  return (
    <ShelfTile
      // The thumbnail, never the asset's own URL: that one is signed, and a parameter appended
      // to it invalidates the signature — the CDN answers 403.
      url={cloudPreviewUrl(asset, { width: PREVIEW_WIDTH }) ?? undefined}
      caption={asset.generation?.modelLabel || asset.name}
      fallbackIcon={assetIcon(asset.type)}
      hint={asset.name}
      label={act?.label ?? asset.name}
      {...(act ? { onClick: act.run } : {})}
    />
  )
}
