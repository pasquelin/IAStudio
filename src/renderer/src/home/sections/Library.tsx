import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { homeSectionLimit } from '@shared/domain/home'
import { Carousel } from '@/design/Carousel'
import { MediaTile } from '@/design/MediaTile'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { assetIcon } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { Section } from '../Section'

const CARD = 132

/** Twice the tile, for a dense display. The CDN resizes; a 4K down the wire to draw 132 does not. */
const PREVIEW_WIDTH = CARD * 2

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

  const [assets, setAssets] = useState<readonly CloudAsset[]>([])

  // Read again when the active key changes: another key is another library, and the tiles of the
  // previous one would be pictures nobody in this account can fetch.
  useEffect(() => {
    let live = true

    getBridge()
      ?.cloud.browse({ pageSize: limit })
      .then(page => {
        if (live) setAssets(page.assets)
      })
      // No key, or the API refused: the shelf stays empty and the section takes itself off.
      .catch(() => {})

    return () => {
      live = false
    }
  }, [owner, limit])

  if (assets.length === 0) return null

  return (
    <Section id="library" title={t('home.sections.library')}>
      <Carousel
        items={assets}
        itemWidth={CARD}
        itemHeight={CARD}
        label={t('home.sections.library')}
        renderCard={asset => <Tile asset={asset} />}
      />
    </Section>
  )
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

  const tile = (
    <MediaTile
      url={cloudPreviewUrl(asset, { width: PREVIEW_WIDTH }) ?? undefined}
      caption={asset.generation?.modelLabel || asset.name}
      fallbackIcon={assetIcon(asset.type)}
    />
  )

  if (!hasProject) return <div title={asset.name}>{tile}</div>

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void useCloud.getState().pull([asset.id])}
      aria-label={t('home.library.fetch', { name: asset.name })}
      className={cn(
        'block size-full cursor-pointer rounded-(--radius-sc-md) border-none bg-transparent p-0',
        'hover:opacity-90 disabled:cursor-default disabled:opacity-60',
        FOCUS_RING,
      )}
    >
      {tile}
    </button>
  )
}
