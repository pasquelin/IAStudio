import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'
import { formatList } from '@/helpers/format'

/**
 * The four things a figure on this screen does not say on its own.
 *
 * None of them is decoration. Without the first, a reader takes a spend for a balance; without
 * the second, a cross-account total reads as an invoice; without the third, a partial report
 * reads as a complete one; without the fourth, a day's work sits on a bar the reader's own
 * calendar does not agree with, and nothing on screen explains why.
 *
 * That fourth one names no hour, on purpose — a review caught the first draft claiming an evening's
 * work lands on the day before, which is true east of Greenwich and BACKWARDS west of it: measured,
 * 21:00 in New York is already tomorrow in UTC. An example that is wrong for half the readers is
 * worse than no example.
 *
 * It is also unconditional, where the other two of its kind are not: a zone is not a circumstance,
 * it is how every figure here was counted.
 */
export function UsageNotes({ report }: { report: UsageReport }) {
  const { t, i18n } = useTranslation()
  // Every one of them answered nothing: all true at once.
  const silent = formatList(
    report.silent.map(account => account.name),
    i18n.language,
    'conjunction',
  )

  return (
    <footer className="border-base-300 text-base-content/70 text-tiny flex flex-col gap-2 border-t pt-3">
      <p>{t('usage.noBalance')}</p>
      <p>{t('usage.countedInUtc')}</p>
      {report.accounts.length > 1 && <p>{t('usage.mixedAccounts')}</p>}
      {silent && <p className="text-warning">{t('usage.silent', { names: silent })}</p>}
    </footer>
  )
}
