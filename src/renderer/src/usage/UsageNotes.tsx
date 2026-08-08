import { useTranslation } from 'react-i18next'
import type { UsageReport } from '@shared/domain/usage'

/**
 * The three things a figure on this screen does not say on its own.
 *
 * None of them is decoration. Without the first, a reader takes a spend for a balance; without
 * the second, a cross-account total reads as an invoice; without the third, a partial report
 * reads as a complete one.
 */
export function UsageNotes({ report }: { report: UsageReport }) {
  const { t } = useTranslation()
  const silent = report.silent.map(account => account.name).join(', ')

  return (
    <footer className="border-base-300 text-base-content/60 flex flex-col gap-1 border-t pt-3 text-[11px]">
      <p>{t('usage.noBalance')}</p>
      {report.accounts.length > 1 && <p>{t('usage.mixedAccounts')}</p>}
      {silent && <p className="text-warning">{t('usage.silent', { names: silent })}</p>}
    </footer>
  )
}
