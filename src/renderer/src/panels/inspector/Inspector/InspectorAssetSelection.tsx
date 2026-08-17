import { assetsById, useAssets } from '@/stores/assets'
import { AssetInspector } from '../AssetInspector/AssetInspector'
import { SelectionSummary } from '../SelectionSummary'
import { InspectorEmpty } from './InspectorEmpty'

/**
 * Several assets at once are summarised rather than detailed: showing the first one's prompt
 * for a selection of twelve is how someone regenerates the wrong thing.
 */
export function InspectorAssetSelection({ ids }: { ids: readonly string[] }) {
  const byId = useAssets(assetsById)

  // Keyed rather than filtered: a selection of a handful against a catalogue of thousands was
  // scanning the whole of it, per render.
  const assets = ids.flatMap(id => byId.get(id) ?? [])

  const [only] = assets
  if (assets.length === 0) return <InspectorEmpty />
  if (assets.length === 1 && only) return <AssetInspector asset={only} />

  const total = assets.reduce((bytes, asset) => bytes + (asset.bytes ?? 0), 0)
  return <SelectionSummary count={assets.length} bytes={total} />
}
