import { mdiCloseCircleOutline, mdiProgressClock } from '@mdi/js'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { cn } from '@/design/cn'
import { ToolButton } from '@/design/ToolButton'
import { failureMessageKey } from '@/services/failure-message'
import { useJobs } from '@/stores/jobs'
import { EmptyState } from './EmptyState'

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
  const percent = Math.round(job.progress * 100)

  return (
    <li className="flex flex-col gap-0.5 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{job.label}</span>

        {job.status === 'running' && (
          <progress
            className="progress w-24"
            value={percent}
            max={100}
            aria-label={`${job.label} ${percent}%`}
          />
        )}

        <span className={cn('shrink-0 text-[11px]', STATUS_COLOR[job.status])}>
          {t(`jobs.status.${job.status}`)}
        </span>

        {!isFinished(job.status) && (
          <ToolButton
            icon={mdiCloseCircleOutline}
            label={t('jobs.cancel')}
            variant="header"
            onClick={() => void cancel(job.id)}
          />
        )}
      </div>

      {job.error && (
        <span role="alert" className="text-danger text-[11px]">
          {t(failureMessageKey(job.error))}
        </span>
      )}
    </li>
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
