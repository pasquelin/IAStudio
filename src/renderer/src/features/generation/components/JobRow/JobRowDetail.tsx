import { useTranslation } from 'react-i18next'
import type { Job } from '@shared/domain/job'
import { failureMessageKey } from '@/services/failureMessage'
import { formatUnits } from '@/helpers/format'

/** What the row says under its bar: why it failed, or what it cost. Never both. */
export function JobRowDetail({ job }: { job: Job }) {
  const { t, i18n } = useTranslation()

  if (job.error) {
    return (
      <span role="alert" className="text-danger text-tiny">
        {t(failureMessageKey(job.error))}
      </span>
    )
  }

  if (job.cost === undefined) return null

  // Through `formatUnits` like every other figure in Compute Units: it groups the thousands
  // AND keeps the decimals of a cheap call, which rounding would report as free.
  return (
    <span className="text-muted text-tiny">
      {t('units.creative', { units: formatUnits(job.cost, i18n.language) })}
    </span>
  )
}
