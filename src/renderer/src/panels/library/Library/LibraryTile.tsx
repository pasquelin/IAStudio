import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { cloudTileFace } from '@/helpers/cloudTile'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { openAsset } from '@/helpers/openAsset'
import { ShelfTile } from '@/design/ShelfTile'

/** The CDN resizes; a 4K down the wire to draw a small tile does not. Same width a pin keeps. */
const PREVIEW_WIDTH = FAVORITE_THUMBNAIL_WIDTH

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
export function LibraryTile({ asset, fetched }: { asset: CloudAsset; fetched: Asset | undefined }) {
  const { t } = useTranslation()
  const hasProject = useProject(state => state.project !== null)
  const busy = useCloud(state => state.busy)

  const act = fetched
    ? { label: t('home.open', { name: asset.name }), run: () => void openAsset(fetched) }
    : hasProject && !busy
      ? {
          label: t('home.library.fetch', { name: asset.name }),
          run: () => void useCloud.getState().pull([asset.id]),
        }
      : null

  return (
    <ShelfTile
      {...cloudTileFace(asset, PREVIEW_WIDTH)}
      hint={asset.name}
      label={act?.label ?? asset.name}
      tip={TIP_LEFT}
      {...(act ? { onClick: act.run } : {})}
    />
  )
}
