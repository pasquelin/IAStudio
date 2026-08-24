import { mdiPin, mdiPinOutline, mdiRefresh } from '@mdi/js'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetGeneration } from '@shared/domain/asset'
import { FAVORITES_MAX, sameRecipe } from '@shared/domain/favorite'
import { PropertySection } from '@/design/PropertySection'
import { PropertyRow } from '@/design/PropertyRow'
import { ToolButton } from '@/design/ToolButton'
import { openGeneratorOn } from '@/helpers/openGenerator'
import { TIP_LEFT } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { useFavorites } from '@/stores/favorites'
import { useLayouts } from '@/stores/layouts'

/**
 * What produced the asset, and the offer to run it again. The prompt is shown whole and
 * selectable: it is the one field anyone wants to copy out and adjust.
 */
export function AssetInspectorGeneration({
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
    openGeneratorOn(workspaceById(workspace).family, generation.modelId, generation.params)
  }

  return (
    <PropertySection title={t('inspector.generation')} scId="asset.generation">
      <PropertyRow label={t('inspector.model')}>{generation.modelLabel}</PropertyRow>
      {generation.seed !== undefined && (
        <PropertyRow label={t('inspector.seed')}>{generation.seed}</PropertyRow>
      )}
      {generation.prompt && (
        <PropertyRow label={t('inspector.prompt')} shape="stacked">
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
          description={t(full && !pinned ? 'inspector.pinFull' : 'inspector.pinHint', {
            max: FAVORITES_MAX,
          })}
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
    </PropertySection>
  )
}
