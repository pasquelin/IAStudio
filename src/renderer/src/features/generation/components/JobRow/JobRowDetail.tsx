import { useTranslation } from 'react-i18next'
import { CREDIT_UNIT } from '@shared/domain/credits'
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

  // 🛑 The UNIT comes off the job: a credit is not a creative unit, and a row labelling one as
  // the other would have two counters read as one.
  const units = formatUnits(job.cost, i18n.language)

  return (
    <span className="text-muted text-tiny">
      {t(job.costUnit === CREDIT_UNIT ? 'accounts.credits.unit' : 'units.creative', { units })}
    </span>
  )
}
