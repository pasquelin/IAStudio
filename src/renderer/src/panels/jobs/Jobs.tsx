import { mdiProgressClock } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { ProgressRow } from '@/design/ProgressRow'
import { failureMessageKey } from '@/services/failure-message'
import { useJobs } from '@/stores/jobs'
import { EmptyState } from '@/design/EmptyState'

const STATUS_COLOR: Record<Job['status'], string> = {
  queued: 'text-muted',
  running: 'text-accent',
  succeeded: 'text-success',
  failed: 'text-danger',
  cancelled: 'text-muted',
}

// Memoised because `apply` preserves the identity of every job it does not touch: a progress
// event then re-renders one row instead of the whole list, every two seconds, per job.
const JobRow = memo(function JobRow({ job }: { job: Job }) {
  const { t } = useTranslation()
  const cancel = useJobs(state => state.cancel)
  const finished = isFinished(job.status)

  return (
    <ProgressRow
      label={job.label}
      ratio={job.status === 'running' ? job.progress : undefined}
      status={t(`jobs.status.${job.status}`)}
      statusClassName={STATUS_COLOR[job.status]}
      cancelLabel={finished ? undefined : t('jobs.cancel')}
      onCancel={finished ? undefined : () => void cancel(job.id)}
      detail={
        job.error && (
          <span role="alert" className="text-danger text-[11px]">
            {t(failureMessageKey(job.error))}
          </span>
        )
      }
    />
  )
})

/** Global jobs list: a generation is launched and the user goes on working elsewhere. */
export function Jobs() {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)

  if (jobs.length === 0) {
    return <EmptyState icon={mdiProgressClock} message={t('jobs.none')} />
  }

  return (
    <ul className="m-0 h-full list-none overflow-auto p-0">
      {jobs.map(job => (
        <JobRow key={job.id} job={job} />
      ))}
    </ul>
  )
}
