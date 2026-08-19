import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { HELPER_VISIBILITIES, NORMAL_LENGTH } from '@shared/domain/scene'
import type { Settings } from '@shared/domain/settings'
import { ChoiceField } from '@/design/ChoiceField'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import type { GestureProps } from '@/design/styles'
import { choicesOf } from './environmentChoices'

export type EnvironmentHelpersSectionProps = {
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
  skeletons: boolean
  onSkeletons: (skeletons: boolean) => void
  gesture: GestureProps
}

/**
 * The marks drawn over a scene to work by — preferences, and none of them reaches a render or an
 * export. `selected` is the default for lights and cameras by decision: a directional light draws
 * a line clear across the scene, so three lamps at once is a viewport nobody can read.
 */
export function EnvironmentHelpersSection({
  view,
  onViewport,
  skeletons,
  onSkeletons,
  gesture,
}: EnvironmentHelpersSectionProps) {
  const { t } = useTranslation()
  // Built once for the three rows that share it, rather than three identical arrays per render.
  const visibility = useMemo(
    () => choicesOf(HELPER_VISIBILITIES, 'environment.visibility_', t),
    [t],
  )

  return (
    <PropertySection title={t('environment.helpers')} defaultOpen={false} scId="helpers">
      <ChoiceField
        label={t('environment.lightHelpers')}
        value={view.lightHelpers}
        options={visibility}
        onChange={lightHelpers => onViewport({ lightHelpers })}
      />

      <ChoiceField
        label={t('environment.cameraHelpers')}
        value={view.cameraHelpers}
        options={visibility}
        onChange={cameraHelpers => onViewport({ cameraHelpers })}
      />

      <ChoiceField
        label={t('environment.boundingBoxes')}
        value={view.boundingBoxes}
        options={visibility}
        onChange={boundingBoxes => onViewport({ boundingBoxes })}
      />

      {/* Session state, unlike its neighbours: skeletons are per document, and the toolbar and
          the native menu already toggle this very field. */}
      <ToggleField label={t('environment.skeletons')} value={skeletons} onChange={onSkeletons} />

      <ToggleField
        label={t('environment.origins')}
        value={view.origins}
        onChange={origins => onViewport({ origins })}
      />

      <ToggleField
        label={t('environment.normals')}
        value={view.normals}
        onChange={normals => onViewport({ normals })}
      />

      {view.normals && (
        <SliderField
          label={t('environment.normalLength')}
          value={view.normalLength}
          min={NORMAL_LENGTH.min}
          max={NORMAL_LENGTH.max}
          step={NORMAL_LENGTH.step}
          onChange={normalLength => onViewport({ normalLength })}
          {...gesture}
        />
      )}
    </PropertySection>
  )
}
