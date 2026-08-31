import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings } from '@shared/domain/settings'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import {
  SHADOW_LEVELS,
  shadowLevelOf,
  shadowPreferenceFor,
  shadowsCapped,
} from '@/engines/scene/shadowLevels'
import { HINT_LEFT } from '@/helpers/tooltip'
import { choicesOf } from '../../../../panels/inspector/unionChoices'

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
      <SelectField
        label={t('environment.shadowsLevel')}
        scId="environment.shadowsLevel"
        value={level}
        options={levels.options}
        onChange={wanted => onViewport(shadowPreferenceFor(wanted))}
        unnamedLabel={t('environment.shadowsCustom')}
        hint={level ? HINT_LEFT(levels.hintOf(level)) : undefined}
      />

      {level === null && <QuietNote>{t('environment.shadowsCustomHint')}</QuietNote>}
      {shadowsCapped(view) && <QuietNote>{t('environment.shadowsCappedHint')}</QuietNote>}
    </PropertySection>
  )
}
