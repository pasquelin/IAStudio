import { useTranslation } from 'react-i18next'
import type { AiOverview, RoleRow } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { QuietNote } from '@/design/QuietNote'
import { aiSectionOf } from '@/helpers/aiSectionLazy'
import { roleLabel } from '@/helpers/roleLabel'
import { ModelInventoryRow } from './ModelInventoryRow'
import { employmentGroupsOf, type EmploymentGroup, type Translate } from './inventory'

/**
 * One line per family, and one per role no family holds — what serves each, or how many of the
 * family are served.
 *
 * Twenty-four generation employments would be a page rather than a band, and the family is the
 * unit a reader already has: it is the space they work in.
 */
export function ModelInventoryEmployments({
  overview,
  onOpen,
}: {
  overview: AiOverview
  onOpen: (section: SettingsSectionId) => void
}) {
  const { t } = useTranslation()
  const groups = employmentGroupsOf(overview)

  if (groups.length === 0) return <QuietNote>{t('home.models.nothing')}</QuietNote>

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-muted text-mini m-0 font-semibold tracking-wider uppercase">
        {t('home.models.employments')}
      </h3>

      {groups.map(group => {
        const label = labelOf(group, t)

        return (
          <ModelInventoryRow
            key={group.key}
            label={label}
            standing={standingOf(group, t)}
            hint={t('home.models.employmentHint', { name: label })}
            // The screen is asked for on the click rather than composed with the group: the
            // registry that answers rides in the settings window's own chunk.
            onClick={() => void aiSectionOf(group.family).then(onOpen)}
          />
        )
      })}
    </div>
  )
}

function labelOf(group: EmploymentGroup, t: Translate): string {
  return group.family === null ? roleLabel(group.role, t) : t(`families.${group.family}`)
}

/**
 * What answers for the group: the provider by name where ONE employment is at stake, a tally
 * otherwise. A family of six that named only its first employment's model would read as an
 * answer about all six.
 */
function standingOf(group: EmploymentGroup, t: Translate): string {
  if (group.sole !== null) return servedBy(group.sole, t)
  if (group.served === 0) return t('home.models.servedNone')

  return t('home.models.served', { count: group.served, total: group.total })
}

function servedBy(row: RoleRow, t: Translate): string {
  const { provider } = row
  if (provider === null) return t('aiModels.providerNone')
  if (provider.kind === 'cloud') return t(`aiClouds.${provider.providerId}`)

  // What SERVES it, which is not always what was chosen: a model since uninstalled falls back.
  const model = row.candidates.find(candidate => candidate.model.id === provider.modelId)

  return model?.model.name ?? t('aiModels.providerNone')
}
