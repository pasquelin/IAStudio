import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FOG_DENSITY, FOG_KINDS, type SceneWorld } from '@shared/domain/scene'
import { ColorField } from '@/design/ColorField'
import { NumberField } from '@/design/NumberField'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { SliderField } from '@/design/SliderField'
import type { GestureProps } from '@/design/styles'
import { fogOfKind } from '@/engines/scene/sceneWorld'
import { HINT_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../unionChoices'

export type EnvironmentAtmosphereSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  gesture: GestureProps
}

/**
 * Haze in the air. Each form carries its own numbers and only its own: a `near`/`far` pair says
 * nothing about a density, so switching between them keeps the colour and nothing else — see
 * `fogOfKind`, which holds that rule.
 */
export function EnvironmentAtmosphereSection({
  world,
  onChange,
  gesture,
}: EnvironmentAtmosphereSectionProps) {
  const { t } = useTranslation()
  const fog = world.fog
  const kinds = useMemo(() => choicesOf(FOG_KINDS, 'environment.fog_', t), [t])

  return (
    <PropertySection title={t('environment.atmosphere')} defaultOpen={false} scId="atmosphere">
      <SelectField
        label={t('environment.fog')}
        scId="environment.fog"
        value={fog.kind}
        options={kinds.options}
        onChange={kind => onChange({ fog: fogOfKind(kind, fog) })}
        hint={HINT_LEFT(kinds.hintOf(fog.kind))}
      />

      {fog.kind !== 'none' && (
        <ColorField
          label={t('environment.fogColor')}
          scId="environment.fogColor"
          value={fog.color}
          onChange={color => onChange({ fog: { ...fog, color } })}
          {...gesture}
        />
      )}

      {fog.kind === 'linear' && (
        <>
          <NumberField
            label={t('environment.fogNear')}
            scId="environment.fogNear"
            value={fog.near}
            min={0}
            step={1}
            onChange={near => onChange({ fog: { ...fog, near } })}
            {...gesture}
          />

          <NumberField
            label={t('environment.fogFar')}
            scId="environment.fogFar"
            value={fog.far}
            min={0}
            step={1}
            onChange={far => onChange({ fog: { ...fog, far } })}
            {...gesture}
          />
        </>
      )}

      {fog.kind === 'exp2' && (
        <SliderField
          label={t('environment.fogDensity')}
          scId="environment.fogDensity"
          value={fog.density}
          min={FOG_DENSITY.min}
          max={FOG_DENSITY.max}
          step={FOG_DENSITY.step}
          onChange={density => onChange({ fog: { ...fog, density } })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
