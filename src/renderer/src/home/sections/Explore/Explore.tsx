import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, type AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { Masonry } from '@/design/Masonry'
import { Section } from '../../Section'
import { QuietNote } from '@/design/QuietNote'
import { useExplore } from '@/hooks/useExplore'
import { ExploreTab } from './ExploreTab'
import { COLUMN_WIDTH, ExploreTile } from './ExploreTile'

/** The shape a tile reserves, from what the API stated. `undefined` when it stated nothing. */
function ratioOf(asset: CloudAsset): number | undefined {
  return asset.width !== undefined && asset.height !== undefined
    ? asset.width / asset.height
    : undefined
}

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
  const { items, exhausted, more } = useExplore(type)

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
            <ExploreTab
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
        items={items}
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
        renderCard={asset => <ExploreTile asset={asset} />}
      />
    </Section>
  )
}
