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
import { ChoiceField } from '@/design/ChoiceField'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import type { GestureProps } from '@/design/styles'
import { choicesOf } from './environmentChoices'

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
      <ChoiceField
        label={t('environment.toneMapping')}
        value={world.toneMapping}
        options={tones}
        onChange={toneMapping => onChange({ toneMapping })}
      />

      {/* Shown whatever the curve: three.js reads `toneMappingExposure` even under `none`, so
          hiding it there would take away a control that works. */}
      <SliderField
        label={t('environment.exposure')}
        value={world.exposure}
        min={EXPOSURE.min}
        max={EXPOSURE.max}
        step={EXPOSURE.step}
        onChange={exposure => onChange({ exposure })}
        {...gesture}
      />

      <ChoiceField
        label={t('environment.quality')}
        value={view.quality}
        options={qualities}
        onChange={quality => onViewport({ quality })}
      />

      <ChoiceField
        label={t('environment.units')}
        value={view.units}
        options={units}
        onChange={units => onViewport({ units })}
      />

      <ToggleField
        label={t('environment.stats')}
        value={view.stats}
        onChange={stats => onViewport({ stats })}
      />
    </PropertySection>
  )
}
