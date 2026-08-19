import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BACKGROUND_KINDS, type SceneWorld } from '@shared/domain/scene'
import { ChoiceField } from '@/design/ChoiceField'
import { ColorField } from '@/design/ColorField'
import { PropertySection } from '@/design/PropertySection'
import type { GestureProps } from '@/design/styles'
import { backgroundOfKind } from '@/engines/scene/sceneWorld'
import { choicesOf } from './environmentChoices'

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

  return (
    <PropertySection title={t('environment.background')} scId="background">
      <ChoiceField
        label={t('environment.backgroundType')}
        value={world.background.kind}
        options={kinds}
        onChange={kind => onChange({ background: backgroundOfKind(kind, world.background) })}
      />

      {/* Only where it means something: a colour picker under « transparent » is a control that
          does nothing, which §35 of the brief rules out. */}
      {world.background.kind === 'color' && (
        <ColorField
          label={t('environment.backgroundColor')}
          value={world.background.color}
          onChange={color => onChange({ background: { kind: 'color', color } })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
