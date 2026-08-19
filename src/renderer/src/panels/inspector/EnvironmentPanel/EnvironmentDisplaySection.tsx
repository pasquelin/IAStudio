import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DISPLAY_MODES, type DisplayMode, type SceneWorld } from '@shared/domain/scene'
import { ChoiceField } from '@/design/ChoiceField'
import { PropertySection } from '@/design/PropertySection'
import {
  ENVIRONMENT_PRESETS,
  presetOf,
  presetPatch,
  type EnvironmentPreset,
} from '@/engines/scene/environmentPresets'
import { choicesOf } from './environmentChoices'

export type EnvironmentDisplaySectionProps = {
  mode: DisplayMode
  onMode: (mode: DisplayMode) => void
  world: SceneWorld
  onPreset: (patch: Partial<SceneWorld>) => void
}

/**
 * How the scene is drawn, and the ready-made worlds to draw it in — the first question anyone
 * asks of this panel, and both answered by a row of buttons before a slider is touched.
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

  return (
    <PropertySection title={t('environment.displayMode')} scId="display">
      <ChoiceField
        label={t('environment.displayMode')}
        value={mode}
        options={modes}
        onChange={onMode}
      />

      <ChoiceField
        label={t('environment.presets')}
        // Read back from the world rather than remembered: a stored name would go on claiming
        // « Night » after the first slider moved. Nothing matching leaves every chip unpressed.
        value={presetOf(world)}
        options={presets}
        onChange={(preset: EnvironmentPreset) => onPreset(presetPatch(preset))}
      />
    </PropertySection>
  )
}
