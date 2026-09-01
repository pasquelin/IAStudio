import { useTranslation } from 'react-i18next'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { PropertySection } from '@/components/PropertySection'
import { PropertyRow } from '@/components/PropertyRow'
import { defined } from '@shared/guards'
import { AssetInspectorGeneration } from './Asset/Inspector/AssetInspectorGeneration'
import { AssetMeasureRows } from './Asset/AssetMeasureRows'

/**
 * One asset of a library nothing here holds yet. Everything `AssetInspector` has and this has not
 * belongs to a catalogue row — no path, no role, no name to change.
 */
export function CloudAssetInspector({ asset }: { asset: CloudAsset }) {
  const { t } = useTranslation()

  return (
    <>
      <PropertySection title={t('inspector.identity')} scId="asset.identity">
        <PropertyRow label={t('inspector.name')}>
          <span className="block w-full truncate">{asset.name}</span>
        </PropertyRow>
        <AssetMeasureRows
          createdAt={asset.createdAt}
          // The library counts in seconds and the rest of the studio in microseconds — see
          // `CloudAsset.durationSeconds`.
          {...defined({
            duration: asset.durationSeconds && asset.durationSeconds * 1_000_000,
            width: asset.width,
            height: asset.height,
            bytes: asset.bytes,
          })}
        />
      </PropertySection>

      {asset.generation && (
        <AssetInspectorGeneration assetId={asset.id} generation={asset.generation} />
      )}
    </>
  )
}
