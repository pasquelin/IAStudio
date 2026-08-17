import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitCommit } from '@shared/domain/git'
import { laneLayout } from '@shared/domain/gitGraph'
import { Button } from '@/design/Button'
import { PANEL_SCROLL } from '@/design/styles'
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
  const pick = useGit(state => state.pick)
  const historyEnded = useGit(state => state.historyEnded)
  const readHistory = useGit(state => state.readHistory)

  // Held across renders: picking a row re-renders the list, and laying the whole graph out again
  // to change which row is highlighted is work for nothing on every click.
  const rows = useMemo(() => laneLayout(commits), [commits])

  return (
    <div className={PANEL_SCROLL}>
      {commits.map((commit, index) => {
        const row = rows[index]
        return row === undefined ? null : (
          <HistoryRow
            key={commit.hash}
            commit={commit}
            row={row}
            picked={picked === commit.hash}
            onPick={() => void pick(picked === commit.hash ? null : commit.hash)}
          />
        )
      })}

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
