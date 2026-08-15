import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'
import { formatList } from '@/helpers/format'

/**
 * The four things a figure on this screen does not say on its own.
 *
 * None of them is decoration, and they are named rather than numbered — a review found the prose
 * counting off a "fourth" that renders second. Without `noBalance`, a reader takes a spend for a
 * balance; without `countedInUtc`, a day's work sits on a bar their own calendar disagrees with;
 * without `mixedAccounts`, a cross-account total reads as an invoice; without `silent`, a partial
 * report reads as a complete one.
 *
 * `countedInUtc` names no hour, on purpose — the first draft claimed an evening's work lands on the
 * day before, which holds east of Greenwich and runs BACKWARDS west of it: measured, 21:00 in New
 * York is already tomorrow in UTC. An example wrong for half the readers is worse than none.
 *
 * It sits second because it qualifies every figure above and below it, and it is unconditional
 * where two of the others are not: a zone is not a circumstance, it is how all of this was counted.
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
