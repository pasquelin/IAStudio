import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { ChoiceField } from '@/design/ChoiceField'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import {
  SHADOW_LEVELS,
  shadowLevelOf,
  shadowPreferenceFor,
  shadowsCapped,
} from '@/engines/scene/shadowLevels'
import { choicesOf } from './environmentChoices'

export type EnvironmentShadowsSectionProps = {
  view: Settings['three']
  onViewport: (patch: Partial<Settings['three']>) => void
}

/**
 * Four words for the three preferences the studio already had — see `shadowLevels.ts`. A
 * combination the preferences screen allows and no level names reads as « custom » rather than
 * being rounded to the nearest, which would silently undo somebody's tuning.
 */
export function EnvironmentShadowsSection({ view, onViewport }: EnvironmentShadowsSectionProps) {
  const { t } = useTranslation()
  const level = shadowLevelOf(view)
  const levels = useMemo(() => choicesOf(SHADOW_LEVELS, 'environment.shadows_', t), [t])

  return (
    <PropertySection title={t('environment.shadows')} defaultOpen={false} scId="shadows">
      <ChoiceField
        label={t('environment.shadowsLevel')}
        value={level}
        options={levels}
        onChange={wanted => onViewport(shadowPreferenceFor(wanted))}
      />

      {level === null && <QuietNote>{t('environment.shadowsCustomHint')}</QuietNote>}
      {shadowsCapped(view) && <QuietNote>{t('environment.shadowsCappedHint')}</QuietNote>}
    </PropertySection>
  )
}
