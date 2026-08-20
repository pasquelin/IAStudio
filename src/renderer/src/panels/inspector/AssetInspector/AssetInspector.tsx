import { mdiFolderOpenOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { InlineRename } from '@/design/InlineRename'
import { PropertySection } from '@/design/PropertySection'
import { PropertyRow } from '@/design/PropertyRow'
import { ToolButton } from '@/design/ToolButton'
import { formatDuration } from '@/engines/timeline/timecode'
import { formatBytes, formatMoment } from '@/helpers/format'
import { generationOf } from '@/helpers/generation'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { renameAsset } from '@/helpers/rename'
import { RoleField } from '../RoleField'
import { useJobs } from '@/stores/jobs'
import { AssetInspectorGeneration } from './AssetInspectorGeneration'

/**
 * One asset, read out — and the prompt behind it, which is what makes the shelf navigable
 * rather than a wall of thumbnails.
 */
export function AssetInspector({ asset }: { asset: Asset }) {
  const { t, i18n } = useTranslation()
  const jobs = useJobs(state => state.jobs)
  const bodies = useJobs(state => state.bodies)
  const [missing, setMissing] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const commitRename = (name: string): void => {
    setRenaming(false)
    renameAsset(asset.id, asset.name, name)
  }

  // Answers false when the file has moved since it was linked, and rejects when the project
  // closed under us: a button that silently does nothing reads as a broken button.
  const reveal = (): void => {
    void getBridge()
      ?.assets.reveal(asset.id)
      .then(shown => setMissing(!shown))
      .catch(() => setMissing(true))
  }

  const generation = generationOf(asset, jobs, bodies)
  const probe = asset.probe

  return (
    <>
      <PropertySection title={t('inspector.identity')} scId="asset.identity">
        {/* Edited where it is read, on a double-click — the gesture every other name of this
            studio answers. The row is the field's host, so the tooltip explains rather than
            repeats: the name is already on screen. */}
        <PropertyRow label={t('inspector.name')}>
          {renaming ? (
            <InlineRename
              value={asset.name}
              label={t('assets.renameLabel')}
              gauge="inline"
              onCommit={commitRename}
            />
          ) : (
            // The hint explains rather than repeats — the name is already on screen, and what
            // is not is that a double-click opens it.
            <span
              className="block w-full truncate"
              onDoubleClick={() => setRenaming(true)}
              {...HINT_LEFT(t('assets.renameHint'))}
            >
              {asset.name}
            </span>
          )}
        </PropertyRow>
        {/* The same field the explorer's face carries, and correctable here for the same
            reason: an asset IS a file the catalogue holds a row for. */}
        <RoleField assetId={asset.id} domain={asset.type} />
        {probe?.duration !== undefined && (
          <PropertyRow label={t('inspector.duration')}>
            {formatDuration(probe.duration)}
          </PropertyRow>
        )}
        {probe?.width !== undefined && probe.height !== undefined && (
          <PropertyRow label={t('inspector.dimensions')}>
            {probe.width} × {probe.height}
          </PropertyRow>
        )}
        {asset.bytes !== undefined && (
          <PropertyRow label={t('inspector.size')}>
            {formatBytes(asset.bytes, unit => t(`units.${unit}`), i18n.language)}
          </PropertyRow>
        )}
        <PropertyRow label={t('inspector.created')}>
          {/* The studio's language, not the machine's — the two differ. */}
          {/* Local: this says when a person made the thing, not what an account was billed. */}
          {formatMoment(asset.createdAt, i18n.language, 'local')}
        </PropertyRow>
      </PropertySection>

      {generation && <AssetInspectorGeneration assetId={asset.id} generation={generation} />}

      {asset.location === 'local' && (
        <PropertySection title={t('inspector.file')} scId="asset.file">
          {/* The PATH, which this row used to leave out: a label, a wide empty column and a
              button at the far end said where nothing. `wrap` because a path is one value that
              takes two lines rather than a name that truncates. */}
          <PropertyRow
            label={t('inspector.onDisk')}
            shape="wrap"
            actions={
              missing ? undefined : (
                <ToolButton
                  icon={mdiFolderOpenOutline}
                  label={t('inspector.reveal')}
                  tooltip={TIP_LEFT}
                  variant="header"
                  onClick={reveal}
                />
              )
            }
          >
            {missing ? (
              <span className="text-muted text-tiny">{t('inspector.fileMissing')}</span>
            ) : (
              (asset.path ?? '')
            )}
          </PropertyRow>
        </PropertySection>
      )}
    </>
  )
}
