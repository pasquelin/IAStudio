import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { ProgressRow } from '@/design/ProgressRow'
import { failureKeyOf } from '@/services/failureMessage'
import { useJobs } from '@/stores/jobs'

export type GeneratorRunProps = {
  /** The generation this panel launched, or `null` while none is in flight. */
  job: Job | null
}

/**
 * How far the generation this panel launched has got, and the way to stop it. In the panel and
 * not only in the jobs bar: a run whose only trace is at the foot of the window reads as a click
 * that did nothing.
 */
export function GeneratorRun({ job }: GeneratorRunProps) {
  const { t } = useTranslation()
  const cancel = useJobs(state => state.cancel)
  if (!job) return null

  const failure = job.error === undefined ? undefined : t(failureKeyOf(job.error))

  return (
    <ul className="px-2 pt-2" data-sc="section:generation.run">
      <ProgressRow
        label={job.label}
        // A queued job has nothing measured yet, and an empty bar reads as a run stuck at zero.
        ratio={job.status === 'running' ? job.progress : undefined}
        status={t(`jobs.status.${job.status}`)}
        tone={job.status === 'failed' ? 'danger' : 'muted'}
        // Offered while it can still be stopped, and only then: a button that cancels a finished
        // job answers nothing and says nothing.
        cancel={
          isFinished(job.status)
            ? undefined
            : { label: t('jobs.cancel'), onClick: () => void cancel(job.id) }
        }
        detail={failure && <p className="text-danger text-tiny">{failure}</p>}
      />
    </ul>
  )
}
