import { useTranslation } from 'react-i18next'
import { ProgressRow } from '@/design/ProgressRow'
import { getBridge } from '@/services/bridge'
import { useDebounced } from '@/hooks/useDebounced'
import { useRescan } from '@/hooks/useRescan'

/**
 * How long a pass must hold before the row appears. Coming back to the window asks for one every
 * five seconds, and the ordinary pass is over in a fraction of this.
 *
 * **The blind spot, written rather than hidden**: nothing floors the FALL, so a pass lasting just
 * past this draws the row and takes it away again — the same jump, in a narrower band. A floor
 * would mean showing a finished pass behind a stop button that no longer stops anything, and
 * saying something untrue was judged worse than a rare jump on a pass that really did read files.
 */
const SHOW_AFTER_MS = 400

/**
 * What the studio is doing to the project folder behind the panel, and the way to call it off.
 *
 * Drawn only for a pass that LASTS, and it is meant to be rare: the row sits in the explorer's own
 * column, so one that appears and vanishes inside a few frames pushes every entry down and back —
 * which the whole panel reads as a flicker, on every return to the window. What brings this on
 * screen is a project where something moved outside the studio: the one case where the pass reads
 * files, and the one where a reader deserves to know why the disk is busy.
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
  // `&& running` because a debounce holds a value BOTH ways: without it the row would linger for
  // as long again after the pass ended, offering a stop for something that is already over.
  const lasting = useDebounced(running, SHOW_AFTER_MS) && running

  if (!lasting) return null

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
