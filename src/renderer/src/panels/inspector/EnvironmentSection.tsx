import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EnvironmentRef } from '@shared/domain/scene'
import { PropertySection } from '@/components/PropertySection'
import { EnvironmentChoice } from './EnvironmentChoice/EnvironmentChoice'

export type EnvironmentSectionProps = {
  environment: EnvironmentRef
  /** The command is the caller's: a scene and a material keep this setting in different places. */
  onChange: (environment: EnvironmentRef) => void
}

/**
 * What lights the subject, and what its materials reflect. A property of the document rather than
 * of any node, which is why it shows whether or not something is selected.
 *
 * The Materials space alone. The 3D space asks a wider question — an intensity and an orientation
 * come with the sky there — and answers it in `EnvironmentPanel/EnvironmentLightingSection`,
 * against a `SceneWorld` this shape has no room for. The choice itself is the same component.
 */
export const EnvironmentSection = memo(function EnvironmentSection({
  environment,
  onChange,
}: EnvironmentSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.environment')} scId="environment">
      <EnvironmentChoice environment={environment} onChange={onChange} />
    </PropertySection>
  )
})
