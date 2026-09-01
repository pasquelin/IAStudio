import { useTranslation } from 'react-i18next'
import { CREDIT_UNIT } from '@shared/domain/credits'
import type { Job } from '@shared/domain/job'
import { failureMessageKey } from '@/services/failureMessage'
import { cn } from '@/helpers/cn'
import { formatUnits } from '@/helpers/format'

/** What the row says under its bar: why it failed, what it answered, or what it cost. One of them. */
export function JobRowDetail({ job }: { job: Job }) {
  const { t, i18n } = useTranslation()

  if (job.error) {
    return (
      <span role="alert" className="text-danger text-tiny">
        {t(failureMessageKey(job.error))}
      </span>
    )
  }

  // 🛑 Before the cost, which a free check quotes at zero: what a runner asked to be said is
  // the whole point of that run. A KEY, and its holes are keys too — nothing here knows a cloud.
  if (job.note) {
    const { labelKey, params, tone } = job.note
    // The holes are keys too, so each is said before it fills one. Under `replace` rather than
    // loose: a hole named `count` or `lng` would be eaten as an i18next option, and the sentence
    // would reach the screen with its hole open.
    const holes = Object.fromEntries(
      Object.entries(params ?? {}).map(([hole, key]): [string, string] => [hole, t(key)]),
    )

    return (
      <span className={cn('text-tiny', tone === 'warning' ? 'text-warning' : 'text-muted')}>
        {t(labelKey, { replace: holes })}
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
