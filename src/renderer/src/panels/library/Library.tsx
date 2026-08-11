import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { cloudPreviewUrl, type CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { TIP_LEFT } from '@/helpers/tooltip'
import { assetIcon } from '@/helpers/workspaces'
import { useShelf } from '@/hooks/use-shelf'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { openFromHome } from '@/home/open'
import { ShelfTile } from '@/design/ShelfTile'
import { ShelfPanel } from '@/panels/shared/ShelfPanel'
import { PANEL_PAGE } from '@/panels/shared/tiles'

const NOTHING: readonly CloudAsset[] = []

/** The CDN resizes; a 4K down the wire to draw a small tile does not. Same width a pin keeps. */
const PREVIEW_WIDTH = FAVORITE_THUMBNAIL_WIDTH

/**
 * The library the API key opens onto, which is not this project's catalogue.
 *
 * Nothing here is stored: the assets are read through on every visit, and the URL that draws a
 * tile is signed and expires. Keeping one would mean a panel showing broken pictures a fortnight
 * later, with nothing to say why — hence a fresh page each time rather than a cache.
 */
export function Library() {
  const { t } = useTranslation()
  const owner = useSettings(activeOwnerId)

  // Read again when the active key changes: another key is another library, and the tiles of the
  // previous one would be pictures nobody in this account can fetch.
  const { value: page, state, retry } = useShelf(NOTHING, browse, owner ?? '')

  // Which of these the project already holds, keyed by the id the library knows them under.
  // Built once for the panel rather than searched per tile: `find` over the whole catalogue in
  // each of two dozen cards would be two dozen walks of it on every render.
  const items = useAssets(shelf => shelf.items)
  const fetchedById = useMemo(() => {
    const found = new Map<string, Asset>()
    for (const item of items) if (item.remoteAssetId) found.set(item.remoteAssetId, item)
    return found
  }, [items])

  return (
    <ShelfPanel
      tool="library"
      items={page}
      // A 429 used to take the band off the page without a word — and since `cloudBrowse` goes
      // through `quietlyReducedBy`, the journal did not say it either.
      state={state}
      onRetry={retry}
      renderCard={asset => <Tile asset={asset} fetched={fetchedById.get(asset.id)} />}
      empty={t('home.library.none')}
    />
  )
}

function browse(): Promise<CloudAsset[]> | undefined {
  return getBridge()
    ?.cloud.browse({ pageSize: PANEL_PAGE })
    .then(page => page.assets)
}

/**
 * One asset of the library, and what a click on it does depends on one thing: whether it is on
 * the disk yet.
 *
 * Already fetched, it opens — the rule the whole home follows. Not fetched, there is nothing to
 * open, so fetching stays the main action on those tiles and only those. Implicit fetching was
 * ruled out: a click that quietly downloads is the surprise this panel exists to end.
 *
 * It stands as a plain picture with no project: the panel says what the account holds, and that
 * is worth showing before a project is open — but nothing here may act without a folder.
 *
 * The click is the tile's own rather than the collection's, which is why this panel passes no
 * `onOpen`: half these cells act and half do not, and a cell that opened them all would download
 * on a click for the ones that cannot.
 */
function Tile({ asset, fetched }: { asset: CloudAsset; fetched: Asset | undefined }) {
  const { t } = useTranslation()
  const hasProject = useProject(state => state.project !== null)
  const busy = useCloud(state => state.busy)

  const act = fetched
    ? { label: t('home.open', { name: asset.name }), run: () => void openFromHome(fetched) }
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
      tip={TIP_LEFT}
      {...(act ? { onClick: act.run } : {})}
    />
  )
}
