import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import type { AiRoleId } from '@shared/domain/aiRole'
import { LANDING_TARGETS, type LandingTarget } from '@shared/domain/landingTarget'
import { SelectField } from '@/design/SelectField'
import { PANEL_SECTION } from '@/design/styles'
import { landingCreatesOf, landingSiblingsOf, type LandingChoice } from '@/generation/landingChoice'
import { roleFolderOf, useFolderRoles } from '@/stores/folderRoles'
import { useDocuments } from '@/stores/documents'

export type GeneratorLandingProps = {
  role: AiRoleId
  choice: LandingChoice
  landing: LandingTarget
  onLanding: (landing: LandingTarget) => void
}

/**
 * Where the result goes, said BEFORE the click and by file NAME: everywhere else a generation
 * adds a picture to a shelf, and here it writes over a file somebody is editing.
 */
export function GeneratorLanding({ role, choice, landing, onLanding }: GeneratorLandingProps) {
  const { t } = useTranslation()

  // 🛑 Memoised on the SIBLINGS, never read straight from the selector: naming a file that does
  // not exist yet calls i18next per candidate — 102 µs at twenty untitled scripts, measured.
  const folder = useFolderRoles(state => roleFolderOf(state, 'script'))
  const siblings = useDocuments(useShallow(state => landingSiblingsOf(role, state, folder)))
  const creates = useMemo(() => landingCreatesOf(role, siblings), [role, siblings])

  const options = useMemo(
    () =>
      LANDING_TARGETS.filter(target => target !== 'document' || choice.into !== null).map(
        target => ({
          value: target,
          label:
            target === 'document'
              ? t('generation.landsInDocument', { file: choice.into })
              : t('generation.landsInNewTab', { file: creates }),
        }),
      ),
    [choice.into, creates, t],
  )

  // Withdrawn rather than drawn dead: with nothing in front there is one destination, and a
  // control offering a single row is a choice nobody can make.
  if (options.length < 2) return null

  return (
    <div className={PANEL_SECTION}>
      <SelectField
        layout="row"
        label={t('generation.landing')}
        value={landing}
        options={options}
        onChange={onLanding}
        scId="generation.landing"
      />

      {/* The other half of the surprise: the script in front does not merely stay put, it TRAVELS
          — a `code2code` is the model rewriting this very file. */}
      {choice.sends !== null && (
        <p className="text-muted text-tiny">
          {t('generation.landingSends', { file: choice.sends })}
        </p>
      )}
    </div>
  )
}
