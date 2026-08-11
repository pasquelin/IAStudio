import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { FAVORITE_THUMBNAIL_WIDTH } from '@shared/domain/favorite'
import { cloudTileFace } from '@/helpers/cloud-tile'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { ShelfTile } from '@/design/ShelfTile'
import { ShelfPanel } from '@/panels/shared/ShelfPanel'
import { useShelf } from '@/hooks/use-shelf'

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
 * What the panel draws, when it has something to draw.
 *
 * `null` is "nothing to measure against, or nothing that resembles it" — an ordinary answer,
 * and not the same thing as a refusal, which `useShelf` reports on its own.
 */
type Lookalikes = { reference: CloudAsset; assets: readonly CloudAsset[] } | null

/**
 * Published work in the vein of this account's latest asset.
 *
 * The likeness is the API's own — visual and semantic at once. WHICH asset it is measured
 * against is decided here and not in the main process: it is a choice this panel makes, and the
 * channel it calls answers for any asset one names.
 *
 * Inert, like the explore feed: these belong to other people.
 */
export function Similar() {
  const { t } = useTranslation()
  const owner = useSettings(activeOwnerId)
  // Two requests behind one shelf, read again when the active key changes: another key is
  // another library, and the reference the previous one named is nobody's here.
  const { value: page, state, retry } = useShelf<Lookalikes>(null, lookalikes, `${owner}`)

  return (
    <div className="flex h-full flex-col">
      {page && (
        // The reference is the whole of what this panel means, and the rail's title cannot carry
        // it: a shelf of lookalikes with nothing named is a shelf of strangers.
        <div className="px-2 pt-2">
          <QuietNote>{t('home.similar.title', { name: page.reference.name })}</QuietNote>
        </div>
      )}

      <ShelfPanel
        tool="similar"
        items={page?.assets ?? []}
        state={state}
        onRetry={retry}
        renderCard={asset => <Tile asset={asset} />}
        empty={t('home.similar.none')}
        refused={t('home.similar.refused')}
      />
    </div>
  )
}

/**
 * Two reads, and the failure of either is a refusal — which is `useShelf`'s to report, so this
 * one lets it through instead of catching it into a state of its own.
 */
async function lookalikes(): Promise<Lookalikes> {
  const bridge = getBridge()
  if (!bridge) return null

  const library = await bridge.cloud.browse({ pageSize: REFERENCE_CANDIDATES })
  const reference = library.assets[0]
  if (!reference) return null

  const assets = await bridge.cloud.similar(reference.id)
  // Settled here rather than at the render: a page then means there is something to draw, and
  // the panel has one way of saying nothing instead of two.
  return assets.length === 0 ? null : { reference, assets }
}

function Tile({ asset }: { asset: CloudAsset }) {
  const { t } = useTranslation()

  return (
    <ShelfTile
      {...cloudTileFace(asset, FAVORITE_THUMBNAIL_WIDTH)}
      hint={asset.name}
      label={t('panels.similar')}
      tip={TIP_RIGHT}
    />
  )
}
