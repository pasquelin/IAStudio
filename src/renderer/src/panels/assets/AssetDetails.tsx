import { useTranslation } from 'react-i18next'
import { PANEL_DETAIL } from '@/design/styles'
import { assetsById, useAssets } from '@/stores/assets'
import { selectedAssetIds, useSelection } from '@/stores/selection'
import { SelectionSummary } from '@/panels/shared/SelectionSummary'
import { AssetInspector } from './AssetInspector/AssetInspector'

/**
 * What the shelf has picked, read out under the shelf itself — the inspector describes the
 * document in front and only that. Several at once are summarised rather than detailed: showing
 * the first one's prompt for a selection of twelve is how someone regenerates the wrong thing.
 */
export function AssetDetails() {
  const { t } = useTranslation()
  const ids = useSelection(selectedAssetIds)
  const byId = useAssets(assetsById)

  // Keyed rather than filtered: a selection of a handful against a catalogue of thousands was
  // scanning the whole of it, per render.
  const assets = ids.flatMap(id => byId.get(id) ?? [])

  // Nothing rather than an empty state: a placeholder here takes height from the list above it.
  if (assets.length === 0) return null

  const [only] = assets

  const total = assets.reduce((bytes, asset) => bytes + (asset.bytes ?? 0), 0)

  return (
    <section className={PANEL_DETAIL} aria-label={t('assets.details')}>
      {assets.length === 1 && only ? (
        <AssetInspector asset={only} />
      ) : (
        <SelectionSummary count={assets.length} bytes={total} />
      )}
    </section>
  )
}
