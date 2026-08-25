import { useTranslation } from 'react-i18next'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { PropertySection } from '@/design/PropertySection'
import { PropertyRow } from '@/design/PropertyRow'
import { formatDuration } from '@/engines/timeline/timecode'
import { formatBytes, formatMoment } from '@/helpers/format'
import { AssetInspectorGeneration } from './AssetInspectorGeneration'

/**
 * One asset of a library nothing here holds yet, read out.
 *
 * `AssetInspector`'s counterpart, and everything it leaves out is something a line with no file
 * cannot answer: no path to reveal, no role to correct, no name to change — all three belong to
 * a catalogue row, and this line has none until it is downloaded.
 *
 * What it keeps is the half that decides whether to spend that download: the prompt behind the
 * asset, which the library carries on the asset itself rather than on a job of this machine.
 */
export function CloudAssetInspector({ asset }: { asset: CloudAsset }) {
  const { t, i18n } = useTranslation()

  return (
    <>
      <PropertySection title={t('inspector.identity')} scId="asset.identity">
        <PropertyRow label={t('inspector.name')}>
          <span className="block w-full truncate">{asset.name}</span>
        </PropertyRow>
        {asset.durationSeconds !== undefined && (
          <PropertyRow label={t('inspector.duration')}>
            {/* The library counts in seconds and the rest of the studio in microseconds — see
                `CloudAsset.durationSeconds`. Converted here, at the one place that prints it. */}
            {formatDuration(asset.durationSeconds * 1_000_000)}
          </PropertyRow>
        )}
        {asset.width !== undefined && asset.height !== undefined && (
          <PropertyRow label={t('inspector.dimensions')}>
            {asset.width} × {asset.height}
          </PropertyRow>
        )}
        {asset.bytes !== undefined && (
          <PropertyRow label={t('inspector.size')}>
            {formatBytes(asset.bytes, unit => t(`units.${unit}`), i18n.language)}
          </PropertyRow>
        )}
        <PropertyRow label={t('inspector.created')}>
          {formatMoment(asset.createdAt, i18n.language, 'local')}
        </PropertyRow>
      </PropertySection>

      {asset.generation && (
        <AssetInspectorGeneration assetId={asset.id} generation={asset.generation} />
      )}
    </>
  )
}
