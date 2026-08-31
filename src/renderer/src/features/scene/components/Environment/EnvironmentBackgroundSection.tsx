import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BACKGROUND_BLUR, BACKGROUND_KINDS, type SceneWorld } from '@shared/domain/scene'
import { ColorField } from '@/components/ColorField'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { SliderField } from '@/components/SliderField'
import type { GestureProps } from '@/components/styles'
import { backgroundOfKind } from '@/engines/scene/sceneWorld'
import { HINT_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../../../../panels/inspector/unionChoices'

export type EnvironmentBackgroundSectionProps = {
  world: SceneWorld
  onChange: (patch: Partial<SceneWorld>) => void
  gesture: GestureProps
}

/**
 * What hangs behind the scene. Choosing a colour does NOT put the sky out — it goes on lighting
 * the subject and filling its reflections, and only the picture stops being drawn.
 */
export function EnvironmentBackgroundSection({
  world,
  onChange,
  gesture,
}: EnvironmentBackgroundSectionProps) {
  const { t } = useTranslation()
  const kinds = useMemo(() => choicesOf(BACKGROUND_KINDS, 'environment.background_', t), [t])
  const background = world.background

  return (
    <PropertySection title={t('environment.background')} scId="background">
      <SelectField
        label={t('environment.backgroundType')}
        scId="environment.backgroundType"
        value={background.kind}
        options={kinds.options}
        onChange={kind => onChange({ background: backgroundOfKind(kind, background) })}
        hint={HINT_LEFT(kinds.hintOf(background.kind))}
      />

      {/* Only where it means something: a colour picker under « transparent » is a control that
          does nothing, which §35 of the brief rules out. */}
      {background.kind === 'color' && (
        <ColorField
          label={t('environment.backgroundColor')}
          scId="environment.backgroundColor"
          value={background.color}
          onChange={color => onChange({ background: { kind: 'color', color } })}
          {...gesture}
        />
      )}

      {/* Under the studio there is no picture to soften — only light — so the row is not drawn
          rather than moving nothing. The sentence that said so read as an error and was not one. */}
      {background.kind === 'environment' && world.environment.kind === 'skybox' && (
        <SliderField
          label={t('environment.backgroundBlur')}
          scId="environment.backgroundBlur"
          value={background.blur}
          min={BACKGROUND_BLUR.min}
          max={BACKGROUND_BLUR.max}
          step={BACKGROUND_BLUR.step}
          onChange={blur => onChange({ background: { kind: 'environment', blur } })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
