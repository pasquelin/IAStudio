import { useTranslation } from 'react-i18next'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { Button } from '@/design/Button'
import { HOME_BLOCK, HOME_BLOCK_HEADING, ROW_SUBJECT } from '@/design/styles'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { cn } from '@/helpers/cn'
import { machineReadings } from '@/helpers/machineSummary'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useBytes } from '@/hooks/useBytes'
import { cloudIdsOf, localStandingOf, type Translate } from './inventory'

/** One source: what it is, where it stands, and the one gesture that changes it. */
type Means = {
  key: string
  label: string
  /** One line each. The machine states four; a source states one. */
  readings: readonly string[]
  /** Absent on the machine, which reports and is acted on from nowhere. */
  action: { label: string; hint: string; section: SettingsSectionId } | null
}

/**
 * What the studio has to work with — the disk, Ollama, the accounts, and the machine under them.
 *
 * The name and its button share a LINE, with the reading under both. Laid out as a three-column
 * row they sat a column apart — on a wide window the button for a source was a thousand pixels
 * from the source it acted on, which is the whole reason the first draft of this band was
 * unreadable.
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

  const sources: Means[] = [
    {
      key: 'local',
      label: t('aiModels.sourceStudio'),
      readings: [localValue(standing, t, bytes)],
      action: {
        label: t('home.models.manage'),
        hint: t('home.models.localHint'),
        section: AI_SECTION,
      },
    },
    {
      key: 'ollama',
      label: t('aiModels.sourceOllama'),
      readings: [ollamaValue(ollama, t)],
      action: {
        label: ollama.installed ? t('home.models.choose') : t('home.models.installOllama'),
        hint: t('home.models.ollamaHint'),
        section: AI_SECTION,
      },
    },
    {
      key: 'clouds',
      label: t('aiModels.sourceCloud'),
      readings: [
        clouds.length === 0
          ? t('home.models.cloudNone')
          : clouds.map(id => t(`aiClouds.${id}`)).join(' · '),
      ],
      action: {
        label: clouds.length === 0 ? t('home.models.addKey') : t('home.models.manageKeys'),
        hint: t('home.models.cloudHint'),
        section: 'account',
      },
    },
    // Last, and with no button: it reports, and nothing here acts on it.
    {
      key: 'machine',
      label: t('home.models.machine'),
      // Four short lines rather than one long one: run together they wrapped, and a wrapped
      // sentence of four figures is where a reader stops looking for the one they came for.
      readings: machineReadings(overview.machine, t, bytes),
      action: null,
    },
  ]

  return (
    <div className={HOME_BLOCK}>
      <h3 className={HOME_BLOCK_HEADING}>{t('home.models.means')}</h3>

      <dl className="m-0 flex flex-col gap-3">
        {sources.map(({ key, label, readings, action }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <dt className={cn(ROW_SUBJECT, 'font-medium')}>{label}</dt>
              {action && (
                <Button {...HINT_LEFT(action.hint)} onClick={() => onOpen(action.section)}>
                  {action.label}
                </Button>
              )}
            </div>
            {readings.map(reading => (
              <dd key={reading} className="text-muted text-tiny m-0 leading-snug">
                {reading}
              </dd>
            ))}
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
