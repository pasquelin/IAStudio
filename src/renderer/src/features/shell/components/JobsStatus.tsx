import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { StatusFlyout } from '@/components/StatusFlyout'
import { StatusProgressFace } from '@/components/StatusProgressFace'
import { Jobs } from '@/features/generation/components/Jobs'
import { useJobs } from '@/stores/jobs'

type Summary = { count: number; ratio: number; failed: number }

function summarize(jobs: readonly Job[]): Summary {
  const running = jobs.filter(job => !isFinished(job.status))
  const total = running.reduce((sum, job) => sum + job.progress, 0)

  return {
    count: running.length,
    ratio: running.length ? total / running.length : 0,
    failed: jobs.filter(job => job.status === 'failed').length,
  }
}

/**
 * Generations, in the status line rather than in a panel of their own.
 *
 * A generation is minutes of waiting the user spends elsewhere: it has to be readable from
 * every section, and a panel could only be in one. Here it costs no surface at all, and the
 * full list is one click away.
 */
export function JobsStatus() {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)

  const { count, ratio, failed } = useMemo(() => summarize(jobs), [jobs])

  // Silent when there is nothing to say. A failure outlives the run it belongs to: one that
  // disappeared with the last running job is one nobody would have read.
  if (!count && !failed) return null

  const label = count ? t('jobs.running', { count }) : t('jobs.failed', { count: failed })

  return (
    <StatusFlyout
      label={t('jobs.open')}
      hint={t('jobs.openHint')}
      // No bar once everything has stopped: what is left on screen is a count of failures, and a
      // bar under it would report the progress of nothing.
      face={<StatusProgressFace label={label} ratio={count > 0 ? ratio : undefined} />}
      panel={
        <div className="max-h-80 w-80 overflow-auto">
          <Jobs />
        </div>
      }
    />
  )
}
