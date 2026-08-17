import { useTranslation } from 'react-i18next'
import { ProgressRow } from '@/design/ProgressRow'
import { getBridge } from '@/services/bridge'
import { useRescan } from '@/hooks/useRescan'

/**
 * What the studio is doing to the project folder behind the panel, and the way to call it off.
 *
 * Drawn only while a pass runs, and it is meant to be rare: the ordinary pass reads the folder,
 * finds every row where the catalogue says, and is over before it could be painted. What brings
 * this on screen is a project where something moved outside the studio — the one case where the
 * pass reads files, and the one where a reader deserves to know why the disk is busy.
 *
 * `ProgressRow` and not a row of its own: the jobs bar and the media import had grown two copies
 * of "something is happening, here is how far" and they had already drifted. The `<ul>` is here
 * because that row is an `<li>` and this panel is not a list — one item, and the reading stays
 * the same as everywhere else.
 *
 * The counts wait for a total: until the pass knows how many files it will read, `0 of 0` would
 * be a number saying less than no number at all.
 */
export function RescanBar() {
  const { t } = useTranslation()
  const { running, done, total } = useRescan()

  if (!running) return null

  return (
    <ul>
      <ProgressRow
        label={t('explorer.rescan')}
        {...(total > 0
          ? { ratio: done / total, status: t('explorer.rescanCount', { done, total }) }
          : { status: '' })}
        cancel={{
          label: t('explorer.rescanStop'),
          onClick: () => void getBridge()?.project.stopRescan(),
        }}
      />
    </ul>
  )
}
