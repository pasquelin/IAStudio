import { useTranslation } from 'react-i18next'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { Section } from '../Section'
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
  const page = useShelf(NOTHING, () => browse(limit), [owner, limit])

  if (page.length === 0) return null

  return (
    <Section id="library" title={t('home.sections.library')}>
      <Carousel
        items={page}
        itemWidth={SHELF_TILE_SIZE}
        itemHeight={SHELF_TILE_SIZE}
        label={t('home.sections.library')}
        renderCard={asset => <Tile asset={asset} />}
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
 * One asset of the library. It fetches into the project when there is one to fetch into, and
 * stands as a plain picture when there is not: the section says what the account holds, and that
 * is worth showing before a project is open — but nothing here may act without a folder to write
 * into.
 */
function Tile({ asset }: { asset: CloudAsset }) {
  const { t } = useTranslation()
  const hasProject = useProject(state => state.project !== null)
  const busy = useCloud(state => state.busy)

  const fetchable = hasProject && !busy

  return (
    <ShelfTile
      // The thumbnail, never the asset's own URL: that one is signed, and a parameter appended
      // to it invalidates the signature — the CDN answers 403.
      url={cloudPreviewUrl(asset, { width: PREVIEW_WIDTH }) ?? undefined}
      caption={asset.generation?.modelLabel || asset.name}
      fallbackIcon={assetIcon(asset.type)}
      hint={asset.name}
      label={t('home.library.fetch', { name: asset.name })}
      {...(fetchable ? { onClick: () => void useCloud.getState().pull([asset.id]) } : {})}
    />
  )
}
