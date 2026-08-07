import { mdiFolderOpenOutline, mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetGeneration } from '@shared/domain/asset'
import { PropertyGroup, PropertyRow } from '@/design/PropertyRow'
import { ToolButton } from '@/design/ToolButton'
import { formatDuration } from '@/engines/timeline/timecode'
import { formatBytes } from '@/helpers/format'
import { generationOf } from '@/helpers/generation'
import { TIP_LEFT } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useTools } from '@/stores/tools'

/**
 * One asset, read out — and the prompt behind it, which is what makes the shelf navigable
 * rather than a wall of thumbnails.
 */
export function AssetInspector({ asset }: { asset: Asset }) {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)
  const bodies = useJobs(state => state.bodies)

  const generation = generationOf(asset, jobs, bodies)
  const probe = asset.probe

  return (
    <>
      <PropertyGroup title={t('inspector.identity')}>
        <PropertyRow label={t('inspector.name')}>{asset.name}</PropertyRow>
        <PropertyRow label={t('inspector.type')}>{t(`assetTypes.${asset.type}`)}</PropertyRow>
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
          <PropertyRow label={t('inspector.size')}>{formatBytes(asset.bytes)}</PropertyRow>
        )}
        <PropertyRow label={t('inspector.created')}>
          {new Date(asset.createdAt).toLocaleString()}
        </PropertyRow>
      </PropertyGroup>

      {generation && <GenerationGroup generation={generation} />}

      {asset.location === 'local' && (
        <PropertyGroup title={t('inspector.file')}>
          {/* The path itself stays in the main process — showing the file is what one does with
              it anyway, and the window never learns the user's folder layout. */}
          <PropertyRow label={t('inspector.onDisk')}>
            <ToolButton
              icon={mdiFolderOpenOutline}
              label={t('inspector.reveal')}
              tooltip={TIP_LEFT}
              onClick={() => void getBridge()?.assets.reveal(asset.id)}
            />
          </PropertyRow>
        </PropertyGroup>
      )}
    </>
  )
}

/**
 * What produced the asset, and the offer to run it again. The prompt is shown whole and
 * selectable: it is the one field anyone wants to copy out and adjust.
 */
function GenerationGroup({ generation }: { generation: AssetGeneration }) {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)

  const regenerate = (): void => {
    const { family } = workspaceById(workspace)
    useModels.getState().prepare(family, generation.modelId, generation.params)
    // The generator may well be closed — it is a tool window like any other.
    useTools.getState().show('right', 'generator')
  }

  return (
    <PropertyGroup title={t('inspector.generation')}>
      <PropertyRow label={t('inspector.model')}>{generation.modelLabel}</PropertyRow>
      {generation.seed !== undefined && (
        <PropertyRow label={t('inspector.seed')}>{generation.seed}</PropertyRow>
      )}
      {generation.prompt && (
        <PropertyRow label={t('inspector.prompt')} stacked>
          <p className="text-text bg-surface rounded-(--radius-sc-sm) p-1.5 text-[11px] whitespace-pre-wrap select-text">
            {generation.prompt}
          </p>
        </PropertyRow>
      )}
      <div className="flex justify-end px-2 pt-1">
        <ToolButton
          icon={mdiRefresh}
          label={t('inspector.regenerate')}
          description={t('inspector.regenerateHint')}
          tooltip={TIP_LEFT}
          variant="header"
          onClick={regenerate}
        />
      </div>
    </PropertyGroup>
  )
}
