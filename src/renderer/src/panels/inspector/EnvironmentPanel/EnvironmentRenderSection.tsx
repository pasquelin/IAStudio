import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DISPLAY_UNITS,
  EXPOSURE,
  TONE_MAPPINGS,
  VIEWPORT_QUALITIES,
  type SceneWorld,
} from '@shared/domain/scene'
import type { Settings } from '@shared/domain/settings'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { SliderField } from '@/components/SliderField'
import { ToggleField } from '@/components/ToggleField'
import type { GestureProps } from '@/components/styles'
import { HINT_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../unionChoices'

export type EnvironmentRenderSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
  gesture: GestureProps
}

/**
 * How a frame is brought down to a screen, and how finely it is drawn. The first two are the
 * document's and are undone by ⌘Z; the last three are the machine's and reach no render. Tone
 * mapping opens on `none` on purpose — turning it on would change how every saved project lands.
 */
export function EnvironmentRenderSection({
  world,
  onChange,
  view,
  onViewport,
  gesture,
}: EnvironmentRenderSectionProps) {
  const { t } = useTranslation()
  const tones = useMemo(() => choicesOf(TONE_MAPPINGS, 'environment.tone_', t), [t])
  const qualities = useMemo(() => choicesOf(VIEWPORT_QUALITIES, 'environment.quality_', t), [t])
  const units = useMemo(() => choicesOf(DISPLAY_UNITS, 'environment.unit_', t), [t])

  return (
    <PropertySection title={t('environment.render')} defaultOpen={false} scId="render">
      <SelectField
        label={t('environment.toneMapping')}
        scId="environment.toneMapping"
        value={world.toneMapping}
        options={tones.options}
        onChange={toneMapping => onChange({ toneMapping })}
        hint={HINT_LEFT(tones.hintOf(world.toneMapping))}
      />

      {/* Shown whatever the curve: three.js reads `toneMappingExposure` even under `none`, so
          hiding it there would take away a control that works. */}
      <SliderField
        label={t('environment.exposure')}
        scId="environment.exposure"
        value={world.exposure}
        min={EXPOSURE.min}
        max={EXPOSURE.max}
        step={EXPOSURE.step}
        onChange={exposure => onChange({ exposure })}
        {...gesture}
      />

      <SelectField
        label={t('environment.quality')}
        scId="environment.quality"
        value={view.quality}
        options={qualities.options}
        onChange={quality => onViewport({ quality })}
        hint={HINT_LEFT(qualities.hintOf(view.quality))}
      />

      <SelectField
        label={t('environment.units')}
        scId="environment.units"
        value={view.units}
        options={units.options}
        onChange={units => onViewport({ units })}
        hint={HINT_LEFT(units.hintOf(view.units))}
      />

      <ToggleField
        label={t('environment.stats')}
        scId="environment.stats"
        value={view.stats}
        onChange={stats => onViewport({ stats })}
      />
    </PropertySection>
  )
}
