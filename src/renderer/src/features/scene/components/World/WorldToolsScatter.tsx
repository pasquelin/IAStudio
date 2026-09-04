import { mdiBrush, mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import { ToolButton } from '@/components/ToolButton'
import {
  SCATTER_DENSITY,
  SCATTER_SCALE,
  SCATTER_SLOPE_ALIGN,
  SCATTER_SPACING,
  SCATTER_TILT,
  type ScatterLayer,
} from '@shared/domain/scene'
import { setScatterRules, setScatterSeed } from '@/engines/scene/scatterCommands'
import { TIP_TOP } from '@/helpers/tooltip'
import { useScenes } from '@/stores/scenes'

export function WorldToolsScatter({
  documentId,
  scatter,
}: {
  documentId: string
  scatter: ScatterLayer
}) {
  const { t } = useTranslation()
  const run = useScenes.getState().runCommand
  const rules = scatter.rules
  const patch = (next: Partial<typeof rules>): void => {
    run(documentId, setScatterRules(scatter.id, { ...rules, ...next }))
  }

  return (
    <PropertySection title={t('world.tools')} scId="world.scatterTools" defaultOpen>
      <div className="flex">
        <ToolButton
          icon={mdiBrush}
          label={t('world.paintMask')}
          description={t('world.paintMaskHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled={scatter.locked}
          onClick={() => undefined}
        />
        <ToolButton
          icon={mdiRefresh}
          label={t('world.regenerate')}
          description={t('world.regenerateHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled={scatter.locked}
          onClick={() => run(documentId, setScatterSeed(scatter.id, scatter.seed + 1))}
        />
      </div>
      <SliderField
        label={t('world.density')}
        value={rules.density}
        min={SCATTER_DENSITY.min}
        max={SCATTER_DENSITY.max}
        step={SCATTER_DENSITY.step}
        onChange={density => patch({ density })}
        scId="world.density"
      />
      <SliderField
        label={t('world.spacing')}
        value={rules.spacing}
        min={SCATTER_SPACING.min}
        max={SCATTER_SPACING.max}
        step={SCATTER_SPACING.step}
        onChange={spacing => patch({ spacing })}
        scId="world.spacing"
      />
      <SliderField
        label={t('world.minScale')}
        value={rules.minScale}
        min={SCATTER_SCALE.min}
        max={SCATTER_SCALE.max}
        step={SCATTER_SCALE.step}
        onChange={minScale => patch({ minScale })}
        scId="world.minScale"
      />
      <SliderField
        label={t('world.maxScale')}
        value={rules.maxScale}
        min={SCATTER_SCALE.min}
        max={SCATTER_SCALE.max}
        step={SCATTER_SCALE.step}
        onChange={maxScale => patch({ maxScale })}
        scId="world.maxScale"
      />
      <SliderField
        label={t('world.slopeAlign')}
        value={rules.slopeAlign}
        min={SCATTER_SLOPE_ALIGN.min}
        max={SCATTER_SLOPE_ALIGN.max}
        step={SCATTER_SLOPE_ALIGN.step}
        onChange={slopeAlign => patch({ slopeAlign })}
        scId="world.slopeAlign"
      />
      <SliderField
        label={t('world.tilt')}
        value={rules.randomTilt}
        min={SCATTER_TILT.min}
        max={SCATTER_TILT.max}
        step={SCATTER_TILT.step}
        onChange={randomTilt => patch({ randomTilt })}
        scId="world.tilt"
      />
    </PropertySection>
  )
}
