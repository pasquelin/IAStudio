import { mdiProgressClock } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { useJobs } from '@/stores/jobs'
import { EmptyState } from '@/design/EmptyState'
import { JobRow } from './JobRow'

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
