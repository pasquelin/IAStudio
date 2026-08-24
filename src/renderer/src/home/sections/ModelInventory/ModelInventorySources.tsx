import { mdiCloudOutline, mdiHarddisk, mdiRobotOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { AiOverview, OllamaOffer } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { AI_SECTION } from '@/helpers/aiSectionLazy'
import { useBytes } from '@/hooks/useBytes'
import { ModelInventoryCard } from './ModelInventoryCard'
import { cloudIdsOf, localStandingOf, type LocalStanding, type Translate } from './inventory'

/** The three places a model can come from, each with what the studio holds of it today. */
export function ModelInventorySources({
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

  return (
    // The same grid the tools band uses, and for the same reason: it tracks the CENTRE rather
    // than the window, which the panel columns beside it narrow without moving a breakpoint.
    <div className="bg-surface grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2 rounded-(--radius-sc-lg) p-3">
      <ModelInventoryCard
        icon={mdiHarddisk}
        title={t('aiModels.sourceStudio')}
        headline={
          standing.installed === 0
            ? t('home.models.localNone')
            : t('home.models.localCount', { count: standing.installed })
        }
        lines={localLines(standing, t, bytes)}
        hint={t('home.models.localHint')}
        onClick={() => onOpen(AI_SECTION)}
      />

      <ModelInventoryCard
        icon={mdiRobotOutline}
        title={t('aiModels.sourceOllama')}
        headline={ollamaHeadline(overview.ollama, t)}
        lines={overview.ollama.names.length === 0 ? [] : [overview.ollama.names.join(' · ')]}
        hint={t('home.models.ollamaHint')}
        onClick={() => onOpen(AI_SECTION)}
      />

      <ModelInventoryCard
        icon={mdiCloudOutline}
        title={t('aiModels.sourceCloud')}
        headline={
          clouds.length === 0
            ? t('home.models.cloudNone')
            : t('home.models.cloudCount', { count: clouds.length })
        }
        lines={[
          clouds.length === 0
            ? t('home.models.cloudNoneHelp')
            : clouds.map(id => t(`aiClouds.${id}`)).join(' · '),
        ]}
        hint={t('home.models.cloudHint')}
        onClick={() => onOpen('account')}
      />
    </div>
  )
}

function localLines(
  standing: LocalStanding,
  t: Translate,
  bytes: (value: number) => string,
): string[] {
  return [
    standing.installed === 0
      ? null
      : t('home.models.localDisk', { size: bytes(standing.installedBytes) }),
    standing.loaded === 0 ? null : t('home.models.localLoaded', { count: standing.loaded }),
    standing.offered === 0 ? null : t('home.models.localOffered', { count: standing.offered }),
    // Said rather than hidden: a catalogue that quietly drops what will not fit reads as a studio
    // shipping less than it does.
    standing.outOfReach === 0
      ? null
      : t('home.models.localOutOfReach', { count: standing.outOfReach }),
  ].filter(line => line !== null)
}

/** The four readings of Ollama, in the order they stop being true. */
function ollamaHeadline(offer: OllamaOffer, t: Translate): string {
  if (!offer.installed) return t('home.models.ollamaMissing')
  if (!offer.ready) return t('home.models.ollamaIdle')
  if (offer.names.length === 0) return t('home.models.ollamaEmpty')

  return t('home.models.ollamaCount', { count: offer.names.length })
}
