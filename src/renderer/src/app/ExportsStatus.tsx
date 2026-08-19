import { mdiChevronUp } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/design/ProgressBar'
import { ProgressRow } from '@/design/ProgressRow'
import { StatusFlyout } from '@/design/StatusFlyout'
import { UiIcon } from '@/design/UiIcon'
import { formatPercent } from '@/helpers/format'
import { useExports } from '@/stores/exports'

/**
 * What the studio is writing out. An export has to be readable from every section — and, unlike
 * a generation, stoppable from there too, which is the half invariant 6 had nowhere to offer.
 */
export function ExportsStatus() {
  const { t, i18n } = useTranslation()
  const running = useExports(state => state.running)

  // Derived here rather than in a selector: `Object.values` allocates, and a store selector that
  // hands back a new array every call re-renders on every snapshot React takes.
  const rows = useMemo(() => Object.values(running), [running])

  // Silent when there is nothing to say. Nothing outlives a run either: a failure has already
  // been reported by whoever asked for the export, and it shows in the activity list.
  if (rows.length === 0) return null

  const ratio = rows.reduce((sum, row) => sum + row.ratio, 0) / rows.length
  const label = t('exports.running', { count: rows.length })

  return (
    <StatusFlyout
      label={t('exports.open')}
      hint={t('exports.openHint')}
      face={
        <>
          <span>{label}</span>
          <ProgressBar ratio={ratio} label={label} className="w-12" />
          <span>{formatPercent(ratio, i18n.language)}</span>
          <UiIcon path={mdiChevronUp} size={12} />
        </>
      }
      panel={
        <ul className="max-h-80 w-80 overflow-auto">
          {rows.map(row => (
            <ProgressRow
              key={row.id}
              label={row.label}
              ratio={row.ratio}
              status={formatPercent(row.ratio, i18n.language)}
              cancel={{
                label: t('exports.cancel'),
                // Read at the press rather than subscribed to: an action never changes, and a
                // second subscription here is re-read on every snapshot React takes.
                onClick: () => useExports.getState().cancelExport(row.id),
              }}
            />
          ))}
        </ul>
      }
    />
  )
}
