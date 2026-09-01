import { useTranslation } from 'react-i18next'
import { CREDIT_UNIT } from '@shared/domain/credits'
import type { Job } from '@shared/domain/job'
import { tripoRigCheckOf } from '@shared/domain/tripo'
import { failureMessageKey } from '@/services/failureMessage'
import { formatUnits } from '@/helpers/format'

/** What the row says under its bar: why it failed, what it answered, or what it cost. One of them. */
export function JobRowDetail({ job }: { job: Job }) {
  const { t, i18n } = useTranslation()

  if (job.error) {
    return (
      <span role="alert" className="text-danger text-tiny">
        {t(failureMessageKey(job.error))}
      </span>
    )
  }

  // 🛑 Before the cost, which a free check quotes at zero: the verdict is the whole point of the
  // run, and it is what says whether the 25 credits a rig costs are worth spending.
  const check = tripoRigCheckOf(job.facts)
  if (check) {
    return (
      <span className={check.riggable ? 'text-muted text-tiny' : 'text-warning text-tiny'}>
        {!check.riggable
          ? t('tripoRigCheck.notRiggable')
          : check.rigType
            ? t('tripoRigCheck.riggableAs', {
                topology: t(`tripoFields.rig_type_${check.rigType}`),
              })
            : t('tripoRigCheck.riggable')}
      </span>
    )
  }

  if (job.cost === undefined) return null

  // 🛑 The UNIT comes off the job: a credit is not a creative unit, and a row labelling one as
  // the other would have two counters read as one.
  const units = formatUnits(job.cost, i18n.language)

  return (
    <span className="text-muted text-tiny">
      {t(job.costUnit === CREDIT_UNIT ? 'accounts.credits.unit' : 'units.creative', { units })}
    </span>
  )
}
