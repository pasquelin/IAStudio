import { useTranslation } from 'react-i18next'
import { HINT_TOP } from '@/helpers/tooltip'
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
 * The counts wait for a total: until the pass knows how many files it will read, `0 of 0` would
 * be a number that says less than no number at all.
 */
export function RescanBar() {
  const { t } = useTranslation()
  const { running, done, total } = useRescan()

  if (!running) return null

  return (
    <div className="text-muted text-tiny flex items-center gap-(--sc-gutter) px-(--sc-gutter) py-(--sc-gutter)">
      <span className="min-w-0 flex-1 truncate">{t('explorer.rescan')}</span>
      {total > 0 && (
        <span className="tabular-nums">{t('explorer.rescanCount', { done, total })}</span>
      )}
      {/* The label is on screen, so the tooltip EXPLAINS rather than repeats — and no
          `aria-label`, which would replace the visible name for a screen reader (WCAG 2.5.3). */}
      <button
        type="button"
        className="hover:bg-elevated shrink-0 rounded px-(--sc-gutter)"
        {...HINT_TOP(t('explorer.rescanStopHint'))}
        onClick={() => void getBridge()?.project.stopRescan()}
      >
        {t('explorer.rescanStop')}
      </button>
    </div>
  )
}
