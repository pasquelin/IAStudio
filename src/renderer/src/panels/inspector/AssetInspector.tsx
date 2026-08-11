import { mdiFolderOpenOutline, mdiPin, mdiPinOutline, mdiRefresh } from '@mdi/js'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetGeneration } from '@shared/domain/asset'
import { FAVORITES_MAX, sameRecipe } from '@shared/domain/favorite'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { ToolButton } from '@/design/ToolButton'
import { formatDuration } from '@/engines/timeline/timecode'
import { formatBytes } from '@/helpers/format'
import { generationOf, openGeneratorOn } from '@/helpers/generation'
import { TIP_LEFT } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useFavorites } from '@/stores/favorites'
import { useJobs } from '@/stores/jobs'
import { useLayouts } from '@/stores/layouts'

/**
 * One asset, read out — and the prompt behind it, which is what makes the shelf navigable
 * rather than a wall of thumbnails.
 */
export function AssetInspector({ asset }: { asset: Asset }) {
  const { t, i18n } = useTranslation()
  const jobs = useJobs(state => state.jobs)
  const bodies = useJobs(state => state.bodies)
  const [missing, setMissing] = useState(false)

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
          <PropertyRow label={t('inspector.size')}>
            {formatBytes(asset.bytes, unit => t(`units.${unit}`))}
          </PropertyRow>
        )}
        <PropertyRow label={t('inspector.created')}>
          {/* The studio's language, not the machine's — the two differ. */}
          {new Date(asset.createdAt).toLocaleString(i18n.language)}
        </PropertyRow>
      </PropertyGroup>

      {generation && <GenerationGroup assetId={asset.id} generation={generation} />}

      {asset.location === 'local' && (
        <PropertyGroup title={t('inspector.file')}>
          <PropertyRow label={t('inspector.onDisk')}>
            {missing ? (
              <span className="text-muted text-tiny">{t('inspector.fileMissing')}</span>
            ) : (
              <ToolButton
                icon={mdiFolderOpenOutline}
                label={t('inspector.reveal')}
                tooltip={TIP_LEFT}
                onClick={reveal}
              />
            )}
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
function GenerationGroup({
  assetId,
  generation,
}: {
  assetId: string
  generation: AssetGeneration
}) {
  const { t } = useTranslation()
  const workspace = useLayouts(state => state.activeWorkspace)
  const pinned = useFavorites(state =>
    state.recipes.some(recipe => sameRecipe(recipe.generation, generation)),
  )
  const full = useFavorites(state => state.recipes.length >= FAVORITES_MAX)

  // Read when the group appears: the shelf that shows these lives on the home, and this panel
  // has to know whether the recipe in front of it is already there before offering to keep it.
  // `load` answers from what it already holds after the first call, so clicking through a shelf
  // of assets costs one read, not one per asset.
  useEffect(() => void useFavorites.getState().load(), [])

  const regenerate = (): void => {
    openGeneratorOn(workspaceById(workspace).scope, generation.modelId, generation.params)
  }

  return (
    <PropertyGroup title={t('inspector.generation')}>
      <PropertyRow label={t('inspector.model')}>{generation.modelLabel}</PropertyRow>
      {generation.seed !== undefined && (
        <PropertyRow label={t('inspector.seed')}>{generation.seed}</PropertyRow>
      )}
      {generation.prompt && (
        <PropertyRow label={t('inspector.prompt')} stacked>
          <p className="text-text bg-surface text-tiny rounded-(--radius-sc-sm) p-1.5 whitespace-pre-wrap select-text">
            {generation.prompt}
          </p>
        </PropertyRow>
      )}
      <div className="flex justify-end gap-2 px-2 pt-1">
        {/* Already pinned, the button says so rather than disappearing: a control that vanishes
            once used leaves no way to tell "done" from "never offered". At the bound it is
            disabled and says why — the store refuses silently, and a click that does nothing
            reads as a broken button. */}
        <ToolButton
          icon={pinned ? mdiPin : mdiPinOutline}
          label={t(pinned ? 'inspector.pinned' : 'inspector.pin')}
          description={t(full && !pinned ? 'inspector.pinFull' : 'inspector.pinHint')}
          tooltip={TIP_LEFT}
          variant="header"
          active={pinned}
          disabled={full && !pinned}
          onClick={() => void useFavorites.getState().pin(assetId)}
        />
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
