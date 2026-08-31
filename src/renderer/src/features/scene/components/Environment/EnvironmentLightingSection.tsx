import { useTranslation } from 'react-i18next'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { ENV_INTENSITY, type SceneWorld } from '@shared/domain/scene'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import type { GestureProps } from '@/components/styles'
import { EnvironmentChoice } from './Choice/EnvironmentChoice'

export type EnvironmentLightingSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  gesture: GestureProps
}

/**
 * What lights the subject and what its materials reflect. A scene is lit by exactly ONE
 * prefiltered map, so the three sources are alternatives rather than layers — hence the choice
 * above. The two dials multiply and turn whichever is in hand, INCLUDING what a sky document
 * already says; see `applyEnvironment`, which holds that half.
 */
export function EnvironmentLightingSection({
  world,
  onChange,
  gesture,
}: EnvironmentLightingSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('environment.ambience')} scId="lighting">
      <EnvironmentChoice
        environment={world.environment}
        onChange={environment => onChange({ environment })}
      />

      <SliderField
        label={t('environment.intensity')}
        scId="environment.intensity"
        value={world.envIntensity}
        min={ENV_INTENSITY.min}
        max={ENV_INTENSITY.max}
        step={ENV_INTENSITY.step}
        onChange={envIntensity => onChange({ envIntensity })}
        {...gesture}
      />

      {/* Turning a procedural room shows nothing: there is no horizon in it to move. */}
      {world.environment.kind !== 'studio' && (
        <SliderField
          label={t('environment.rotation')}
          scId="environment.rotation"
          // Degrees on screen, radians in the document — the rule every other angle follows.
          value={Math.round(toDegrees(world.envRotation))}
          min={0}
          max={360}
          step={1}
          onChange={degrees => onChange({ envRotation: toRadians(degrees) })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
