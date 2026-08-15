import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { Masonry } from '@/design/Masonry'
import { MediaTile } from '@/design/MediaTile'
import { chipSkin } from '@/design/styles'
import { cloudTileFace } from '@/helpers/cloud-tile'
import { Section } from '../Section'
import { QuietNote } from '@/design/QuietNote'
import { useExplore } from '../use-explore'
import { HINT_BOTTOM } from '@/helpers/tooltip'

/** What one column aims for. Wider than a shelf tile: this is the band people browse. */
const COLUMN_WIDTH = 220

/** The CDN resizes. Twice the column, so the tiles hold up on a dense display. */
const PREVIEW_WIDTH = 440

/**
 * What everyone published, by kind — the one band of the home that is not about this account.
 *
 * One kind at a time rather than a mixed feed: a masonry of pictures interleaved with sound
 * files is a grid of grey rectangles, and the API cannot order the two against each other
 * anyway. The tabs are the studio's six kinds, which is also exactly what the feed can be
 * filtered down to.
 */
export function Explore() {
  const { t } = useTranslation()
  const [type, setType] = useState<AssetType>('image')
  const { assets, exhausted, more } = useExplore(type)

  return (
    <Section
      id="explore"
      title={t('home.sections.explore')}
      // The feed is the one band tall enough to scroll past its own controls, and losing the
      // tabs halfway down means scrolling back up to change kind.
      sticky
      actions={
        <div role="tablist" aria-label={t('home.sections.explore')} className="flex gap-2">
          {ASSET_TYPES.map(candidate => (
            <Tab
              key={candidate}
              type={candidate}
              current={candidate === type}
              onSelect={() => setType(candidate)}
            />
          ))}
        </div>
      }
    >
      <Masonry
        items={assets}
        columnWidth={COLUMN_WIDTH}
        label={t(`assetTypes.${type}`)}
        ratioOf={ratioOf}
        onReachEnd={more}
        // Only `exhausted` may say the feed is empty. Anything else — the first round trip, or
        // a page the studio narrowed away after the index answered — still has pages behind it,
        // and announcing emptiness there is a claim that is about to be contradicted.
        empty={
          <QuietNote standalone>
            {t(exhausted ? 'home.explore.none' : 'home.explore.loading')}
          </QuietNote>
        }
        renderCard={asset => <Tile asset={asset} />}
      />
    </Section>
  )
}

/** The shape a tile reserves, from what the API stated. `undefined` when it stated nothing. */
function ratioOf(asset: CloudAsset): number | undefined {
  return asset.width !== undefined && asset.height !== undefined
    ? asset.width / asset.height
    : undefined
}

type TabProps = {
  type: AssetType
  current: boolean
  onSelect: () => void
}

function Tab({ type, current, onSelect }: TabProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      role="tab"
      aria-selected={current}
      {...HINT_BOTTOM(t('home.exploreTabHint'))}
      onClick={onSelect}
      className={chipSkin(current)}
    >
      {t(`assetTypes.${type}`)}
    </button>
  )
}

/**
 * One published asset. Inert on purpose: it belongs to somebody else, and the studio has no
 * measured way to bring one in — `cloud.pull` is the library's errand, over assets this key
 * owns. Showing a fetch button that may refuse is worse than showing none.
 */
function Tile({ asset }: { asset: CloudAsset }) {
  return <MediaTile fill {...cloudTileFace(asset, PREVIEW_WIDTH)} />
}
