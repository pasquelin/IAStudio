import { useTranslation } from 'react-i18next'
import type { AiOverview } from '@shared/domain/aiOverview'
import type { SettingsSectionId } from '@shared/domain/settings'
import { ProgressBar } from '@/design/ProgressBar'
import { ModelInventoryAdvice } from './ModelInventoryAdvice'
import { servedTotalsOf } from './inventory'

/**
 * Where the studio stands, in one figure, and the two things that would move it most.
 *
 * It opens the band because it is the only part a reader needs before deciding whether to read
 * the rest. The advice sat at the FOOT until now, under three blocks of detail — the two lines
 * that can actually be acted on were the last thing anyone reached.
 */
export function ModelInventoryVerdict({
  overview,
  onOpen,
}: {
  overview: AiOverview
  onOpen: (section: SettingsSectionId) => void
}) {
  const { t } = useTranslation()
  const { served, total } = servedTotalsOf(overview)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-text text-body m-0 font-semibold">
        {t('home.models.verdict', { count: served, total })}
      </p>

      {/* Only where there is something to be a fraction OF: a bar at zero over zero says the
          studio is empty when it means the catalogue answered nothing yet. */}
      {total > 0 && (
        <ProgressBar
          ratio={served / total}
          label={t('home.models.verdictBar')}
          className="max-w-(--sc-verdict-bar)"
        />
      )}

      <ModelInventoryAdvice overview={overview} onOpen={onOpen} />
    </div>
  )
}
