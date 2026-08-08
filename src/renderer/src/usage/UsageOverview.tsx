import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { UsageReport } from '@shared/domain/usage'
import { UsageNotes } from './UsageNotes'
import { formatDay, formatMoney, formatUnits } from './format'

export function UsageOverview({ report }: { report: UsageReport }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const money =
    report.price && formatMoney(report.units * report.price.perUnit, report.price.currency, locale)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap gap-8">
        <Figure
          label={t('usage.total')}
          value={`${formatUnits(report.units, locale)} ${t('usage.units')}`}
        >
          {money && <span className="text-base-content/60 text-xs">≈ {money}</span>}
        </Figure>
        <Figure
          label={t('usage.discount')}
          value={`${formatUnits(report.discount, locale)} ${t('usage.units')}`}
        />
        <Figure label={t('usage.jobs')} value={formatUnits(report.jobs, locale)} />
      </section>

      {money && <p className="text-base-content/60 text-xs">{t('usage.indicative')}</p>}

      {report.daily.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium">{t('usage.daily')}</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...report.daily]}>
                <XAxis
                  dataKey="date"
                  tickFormatter={date => formatDay(date, locale)}
                  tick={{ fontSize: 10 }}
                  // The axis is drawn by the theme, not by a colour written here.
                  className="fill-base-content/60"
                  interval="preserveStartEnd"
                />
                <Tooltip
                  cursor={false}
                  labelFormatter={date => formatDay(String(date), locale)}
                  formatter={(value: unknown) => [
                    `${formatUnits(typeof value === 'number' ? value : 0, locale)} ${t('usage.units')}`,
                    t('usage.total'),
                  ]}
                />
                <Bar dataKey="units" className="fill-primary" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {report.accounts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium">{t('usage.perAccount')}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {report.accounts.map(account => (
              <li
                key={account.accountId}
                className="border-base-300 flex items-baseline justify-between border-b py-1.5 text-xs last:border-b-0"
              >
                <span>{account.name}</span>
                <span className="font-mono">
                  {formatUnits(account.units, locale)} {t('usage.units')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <UsageNotes report={report} />
    </div>
  )
}

function Figure({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base-content/60 text-[11px] uppercase">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
      {children}
    </div>
  )
}
