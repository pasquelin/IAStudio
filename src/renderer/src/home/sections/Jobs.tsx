import { useTranslation } from 'react-i18next'
import { isFinished } from '@shared/domain/job'
import { ProgressRow } from '@/design/ProgressRow'
import { useJobs } from '@/stores/jobs'
import { Section } from '../Section'

/**
 * What the studio is doing right now. A list rather than a shelf: progress is read down a
 * column, and a bar that scrolls sideways is a bar nobody watches.
 *
 * Nothing running means nothing to say — the section takes no room rather than announcing its
 * own emptiness, which on a home would be a line of furniture.
 */
export function Jobs() {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)

  const running = jobs.filter(job => !isFinished(job.status))
  if (running.length === 0) return null

  return (
    <Section title={t('home.sections.jobs')}>
      <div className="bg-surface flex flex-col gap-1 rounded-(--radius-sc-lg) p-2">
        {running.map(job => (
          <ProgressRow
            key={job.id}
            label={job.label}
            ratio={job.progress}
            status={t(`jobs.status.${job.status}`)}
            tone={job.status === 'running' ? 'accent' : 'muted'}
            cancel={{
              label: t('jobs.cancel'),
              onClick: () => void useJobs.getState().cancel(job.id),
            }}
          />
        ))}
      </div>
    </Section>
  )
}
