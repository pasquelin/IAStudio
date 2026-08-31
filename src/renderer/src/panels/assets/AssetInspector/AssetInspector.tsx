import { mdiFolderOpenOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assetBadgeOf, type Asset } from '@shared/domain/asset'
import { defined } from '@shared/guards'
import { AssetBadge } from '@/components/AssetBadge'
import { InlineRename } from '@/components/InlineRename'
import { PropertySection } from '@/components/PropertySection'
import { PropertyRow } from '@/components/PropertyRow'
import { ToolButton } from '@/components/ToolButton'
import { generationOf } from '@/helpers/generation'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { renameAsset } from '@/helpers/rename'
import { RoleField } from '@/panels/shared/RoleField'
import { useBadgeLabels } from '@/hooks/useBadgeLabels'
import { useJobs } from '@/stores/jobs'
import { activeOwnerId, useSettings } from '@/stores/settings'
import { AssetInspectorGeneration } from './AssetInspectorGeneration'
import { AssetMeasureRows } from './AssetMeasureRows'

/**
 * One asset, read out — and the prompt behind it, which is what makes the shelf navigable
 * rather than a wall of thumbnails.
 */
export function AssetInspector({ asset }: { asset: Asset }) {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)
  const bodies = useJobs(state => state.bodies)
  const badgeLabels = useBadgeLabels()
  const ownerId = useSettings(activeOwnerId)
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
  const badge = assetBadgeOf(asset, ownerId)
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
        {/* Where this row stands against the library — the one reading of an asset the remote
            browser can no longer show, having stopped drawing local lines. */}
        <PropertyRow label={t('assets.syncState')}>
          <AssetBadge badge={badge} label={badgeLabels.get(badge) ?? ''} showQuiet />
        </PropertyRow>
        <AssetMeasureRows
          createdAt={asset.createdAt}
          {...defined({
            duration: probe?.duration,
            width: probe?.width,
            height: probe?.height,
            bytes: asset.bytes,
          })}
        />
      </PropertySection>

      {generation && <AssetInspectorGeneration assetId={asset.id} generation={generation} />}

      {asset.location === 'local' && (
        <PropertySection title={t('inspector.file')} scId="asset.file">
          {/* The PATH, which this row used to leave out: a label, a wide empty column and a
              button at the far end said where nothing. Clipped at its HEAD — see `PropertyShape`
              — where it used to break mid-word and take a second line to say nothing more. */}
          <PropertyRow
            label={t('inspector.onDisk')}
            shape="path"
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
