import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { ProgressRow } from '@/design/ProgressRow'
import type { StatusTone } from '@/design/styles'
import { failureMessageKey } from '@/services/failure-message'
import { useJobs } from '@/stores/jobs'
import { formatUnits } from '@/usage/format'

const STATUS_TONE: Record<Job['status'], StatusTone> = {
  queued: 'muted',
  running: 'accent',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'muted',
}

/** What the row says under its bar: why it failed, or what it cost. Never both. */
function JobDetail({ job }: { job: Job }) {
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
      {t('usage.amount', { units: formatUnits(job.cost, i18n.language) })}
    </span>
  )
}

/**
 * One generation, as a line. In a file of its own because the panel is no longer the only place
 * that lists jobs — the home does too, and the copy it started with had already lost the tone
 * table, the guard on the bar and the failure detail.
 *
 * Memoised because `apply` preserves the identity of every job it does not touch: a progress
 * event then re-renders one row instead of the whole list, every two seconds, per job.
 */
export const JobRow = memo(function JobRow({ job }: { job: Job }) {
  const { t } = useTranslation()
  const cancel = useJobs(state => state.cancel)
  const finished = isFinished(job.status)

  return (
    <ProgressRow
      label={job.label}
      // Only while it runs: a queued job has no progress to show, and a finished one would draw
      // a bar frozen wherever it stopped.
      ratio={job.status === 'running' ? job.progress : undefined}
      status={t(`jobs.status.${job.status}`)}
      tone={STATUS_TONE[job.status]}
      cancel={
        finished ? undefined : { label: t('jobs.cancel'), onClick: () => void cancel(job.id) }
      }
      detail={<JobDetail job={job} />}
    />
  )
})
