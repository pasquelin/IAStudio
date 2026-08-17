import { mdiProgressClock } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { useJobs } from '@/stores/jobs'
import { EmptyState } from '@/design/EmptyState'
import { JobRow } from './JobRow/JobRow'

/**
 * Global jobs list: a generation is launched and the user goes on working elsewhere. Read from
 * the status bar's flyout, and from the home's right column since it became a panel there.
 */
export function Jobs() {
  const { t } = useTranslation()
  const jobs = useJobs(state => state.jobs)

  if (jobs.length === 0) {
    // Spelled out rather than read from the rail's table: the status bar opens this list on the
    // first screen, and `toolRegistry` would pull the scene's node kinds into that chunk. The
    // rail carries the same glyph, and says so where it declares it.
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
