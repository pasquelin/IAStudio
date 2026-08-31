import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DISPLAY_MODES, type DisplayMode, type SceneWorld } from '@shared/domain/scene'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { ENVIRONMENT_PRESETS, presetOf, presetPatch } from '@/engines/scene/environmentPresets'
import { HINT_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../../../shell/components/unionChoices'

export type EnvironmentDisplaySectionProps = {
  mode: DisplayMode
  onMode: (mode: DisplayMode) => void
  world: SceneWorld
  onPreset: (patch: Partial<SceneWorld>) => void
}

/**
 * How the scene is drawn, and the ready-made worlds to draw it in — the first question anyone
 * asks of this panel, and both answered before a slider is touched.
 */
export function EnvironmentDisplaySection({
  mode,
  onMode,
  world,
  onPreset,
}: EnvironmentDisplaySectionProps) {
  const { t } = useTranslation()
  // Constant modulo the language, and this panel re-renders on every frame of a slider drag.
  const modes = useMemo(() => choicesOf(DISPLAY_MODES, 'sceneDisplay.', t), [t])
  const presets = useMemo(() => choicesOf(ENVIRONMENT_PRESETS, 'environment.preset_', t), [t])

  // Read back from the world rather than remembered: a stored name would go on claiming « Night »
  // after the first slider moved.
  const preset = presetOf(world)

  return (
    <PropertySection title={t('environment.displayMode')} scId="display">
      <SelectField
        label={t('environment.displayMode')}
        scId="environment.displayMode"
        value={mode}
        options={modes.options}
        onChange={onMode}
        hint={HINT_LEFT(modes.hintOf(mode))}
      />

      <SelectField
        label={t('environment.presets')}
        scId="environment.presets"
        value={preset}
        options={presets.options}
        onChange={picked => onPreset(presetPatch(picked))}
        unnamedLabel={t('environment.presetCustom')}
        hint={preset ? HINT_LEFT(presets.hintOf(preset)) : undefined}
      />
    </PropertySection>
  )
}
