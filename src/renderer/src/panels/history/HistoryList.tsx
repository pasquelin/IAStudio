import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitCommit } from '@shared/domain/git'
import { laneLayout } from '@shared/domain/gitGraph'
import { Button } from '@/components/Button'
import { PANEL_SCROLL } from '@/components/styles'
import { HINT_TOP } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'
import { HistoryRow } from './HistoryRow'

/**
 * The log, one row per version, with the branch graph down its left edge.
 *
 * The layout is computed for the WHOLE list rather than per row: a lane belongs to the commits
 * above and below it as much as to its own, and a row that worked its own column out would draw
 * a line that stops at both its edges.
 */
export function HistoryList({ commits }: { commits: readonly GitCommit[] }) {
  const { t } = useTranslation()
  const picked = useGit(state => state.picked)
  const historyEnded = useGit(state => state.historyEnded)
  const readHistory = useGit(state => state.readHistory)

  // Held across renders: picking a row re-renders the list, and laying the whole graph out again
  // to change which row is highlighted is work for nothing on every click. It is also what keeps
  // each row's props identical across that render, which is what makes memoising them worth it.
  const { width, rows } = useMemo(() => laneLayout(commits), [commits])

  return (
    <div className={PANEL_SCROLL}>
      {rows.map(row => (
        <HistoryRow
          key={row.commit.hash}
          row={row}
          width={width}
          picked={picked === row.commit.hash}
        />
      ))}

      {!historyEnded && (
        <div className="flex justify-center p-2">
          <Button {...HINT_TOP(t('git.moreHint'))} onClick={() => void readHistory(true)}>
            {t('git.more')}
          </Button>
        </div>
      )}
    </div>
  )
}
