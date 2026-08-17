import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { useShelf } from '@/hooks/use-shelf'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { ShelfPanel } from '@/panels/shared/ShelfPanel'
import { PANEL_PAGE } from '@/panels/shared/tiles'
import { LibraryTile } from './LibraryTile'

const NOTHING: readonly CloudAsset[] = []

function browse(): Promise<CloudAsset[]> | undefined {
  return getBridge()
    ?.cloud.browse({ pageSize: PANEL_PAGE })
    .then(page => page.assets)
}

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
      renderCard={asset => <LibraryTile asset={asset} fetched={fetchedById.get(asset.id)} />}
      empty={t('home.library.none')}
    />
  )
}
