import { useTranslation } from 'react-i18next'
import { runningJobs } from '@shared/domain/job'
import { JobRow } from '@/panels/jobs/JobRow'
import { homeSectionLimit } from '@shared/domain/home'
import { useJobs } from '@/stores/jobs'
import { useSettings } from '@/stores/settings'
import { SHELF_BLOCK } from '../styles'
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
  // The whole list, filtered here — the same subscription the jobs panel takes. This band draws
  // the progress, so it has to follow it; `JobRow` is memoised, so only the rows that moved
  // re-render.
  const sections = useSettings(state => state.settings.home.sections)
  const running = runningJobs(useJobs(state => state.jobs)).slice(
    0,
    homeSectionLimit(sections, 'jobs'),
  )

  if (running.length === 0) return null

  return (
    <Section id="jobs" title={t('home.sections.jobs')}>
      <ul className={SHELF_BLOCK}>
        {running.map(job => (
          <JobRow key={job.id} job={job} />
        ))}
      </ul>
    </Section>
  )
}
