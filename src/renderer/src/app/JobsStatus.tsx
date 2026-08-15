import { mdiChevronUp } from '@mdi/js'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Job } from '@shared/domain/job'
import { Flyout } from '@/design/Flyout'
import { ProgressBar } from '@/design/ProgressBar'
import { UiIcon } from '@/design/UiIcon'
import { STATUS_BUTTON } from '@/design/styles'
import { formatPercent } from '@/helpers/format'
import { TIP_TOP } from '@/helpers/tooltip'
import { Jobs } from '@/panels/jobs/Jobs'
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
  const { t, i18n } = useTranslation()
  const jobs = useJobs(state => state.jobs)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const { count, ratio, failed } = useMemo(() => summarize(jobs), [jobs])

  // Silent when there is nothing to say. A failure outlives the run it belongs to: one that
  // disappeared with the last running job is one nobody would have read.
  if (!count && !failed) return null

  const label = count ? t('jobs.running', { count }) : t('jobs.failed', { count: failed })

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        {...TIP_TOP(t('jobs.open'), false, t('jobs.openHint'))}
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={STATUS_BUTTON}
      >
        <span>{label}</span>
        {count > 0 && (
          <>
            <ProgressBar ratio={ratio} label={label} className="w-12" />
            <span>{formatPercent(ratio, i18n.language)}</span>
          </>
        )}
        <UiIcon path={mdiChevronUp} size={12} />
      </button>

      {open && (
        <Flyout anchor={anchor} placement="above" onDismiss={close}>
          <div className="max-h-80 w-80 overflow-auto">
            <Jobs />
          </div>
        </Flyout>
      )}
    </>
  )
}
