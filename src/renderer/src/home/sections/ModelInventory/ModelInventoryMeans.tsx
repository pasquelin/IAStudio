import { useTranslation } from 'react-i18next'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { Button } from '@/design/Button'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { machineSummary } from '@/helpers/machineSummary'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import { HOME_BLOCK, HOME_BLOCK_HEADING } from '@/design/styles'
import { cloudIdsOf, localStandingOf, type Translate } from './inventory'

/** One line: what it is, where it stands, and the one gesture that changes it. */
type Means = {
  key: string
  label: string
  value: string
  /** Absent on the machine, which reports and cannot be acted on from here. */
  action: { label: string; hint: string; section: SettingsSectionId } | null
}

/**
 * What the studio has to work with — the machine, the disk, Ollama, the accounts.
 *
 * Every line carries its own action with a VERB on it. Three cards that were each one big button
 * stood here until now, and two of them opened the same screen: a surface that acts has to say
 * what the click does, and « Ollama » is not a thing one does.
 */
export function ModelInventoryMeans({
  overview,
  onOpen,
}: {
  overview: AiOverview
  onOpen: (section: SettingsSectionId) => void
}) {
  const { t } = useTranslation()
  const bytes = useBytes()

  const standing = localStandingOf(overview)
  const clouds = cloudIdsOf(overview)
  const { ollama } = overview

  const lines: Means[] = [
    {
      key: 'machine',
      label: t('home.models.machine'),
      value: machineSummary(overview.machine, t, bytes),
      action: null,
    },
    {
      key: 'local',
      label: t('aiModels.sourceStudio'),
      value: localValue(standing, t, bytes),
      action: {
        label: t('home.models.manage'),
        hint: t('home.models.localHint'),
        section: AI_SECTION,
      },
    },
    {
      key: 'ollama',
      label: t('aiModels.sourceOllama'),
      value: ollamaValue(ollama, t),
      action: {
        label: ollama.installed ? t('home.models.choose') : t('home.models.installOllama'),
        hint: t('home.models.ollamaHint'),
        section: AI_SECTION,
      },
    },
    {
      key: 'clouds',
      label: t('aiModels.sourceCloud'),
      value:
        clouds.length === 0
          ? t('home.models.cloudNone')
          : clouds.map(id => t(`aiClouds.${id}`)).join(' · '),
      action: {
        label: clouds.length === 0 ? t('home.models.addKey') : t('home.models.manageKeys'),
        hint: t('home.models.cloudHint'),
        section: 'account',
      },
    },
  ]

  return (
    <div className={HOME_BLOCK}>
      <h3 className={HOME_BLOCK_HEADING}>{t('home.models.means')}</h3>

      <dl className="m-0 flex flex-col gap-1.5">
        {lines.map(({ key, label, value, action }) => (
          <div key={key} className="flex items-center gap-3">
            <dt className="text-muted w-32 shrink-0 text-xs">{label}</dt>
            <dd className="text-text m-0 min-w-0 flex-1 text-xs">{value}</dd>
            {action && (
              <Button
                {...HINT_LEFT(action.hint)}
                className="shrink-0"
                onClick={() => onOpen(action.section)}
              >
                {action.label}
              </Button>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}

function localValue(
  standing: ReturnType<typeof localStandingOf>,
  t: Translate,
  bytes: (value: number) => string,
): string {
  if (standing.installed === 0) return t('home.models.localNone')

  return [
    t('home.models.localCount', { count: standing.installed }),
    bytes(standing.installedBytes),
    standing.loaded === 0 ? null : t('home.models.localLoaded', { count: standing.loaded }),
  ]
    .filter(part => part !== null)
    .join(' · ')
}

/** The four readings of Ollama, in the order they stop being true. */
function ollamaValue(offer: AiOverview['ollama'], t: Translate): string {
  if (!offer.installed) return t('home.models.ollamaMissing')
  if (!offer.ready) return t('home.models.ollamaIdle')
  if (offer.names.length === 0) return t('home.models.ollamaEmpty')

  return `${t('home.models.ollamaCount', { count: offer.names.length })} · ${offer.names.join(' · ')}`
}
