import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { shortHash } from '@shared/domain/git'
import type { GitLaneRow } from '@shared/domain/gitGraph'
import { ROW_SUBJECT, rowSkin } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { formatMoment } from '@/helpers/format'
import { useGit } from '@/stores/git'
import { HistoryGraph } from './HistoryGraph'
import { RefBadge } from './RefBadge'

export type HistoryRowProps = {
  row: GitLaneRow
  /** Columns the graph reserves, which is one number for the whole log rather than for this row. */
  width: number
  picked: boolean
}

/**
 * One recorded version, across the width of the band.
 *
 * Four columns and a graph, in the order a history is read: which lane, which commit, what it
 * says, who wrote it, when. The message takes what is left, because it is the only one of the
 * five whose length is the user's own.
 *
 * Memoised, and it takes no callback for that to hold: a handler built per row would be a new
 * identity on every render of the list, so every one of the sixty rows would redraw its SVG
 * because one of them was clicked. `pick` is read off the store where the click is answered.
 */
export const HistoryRow = memo(function HistoryRow({ row, width, picked }: HistoryRowProps) {
  const { i18n } = useTranslation()
  const commit = row.commit

  return (
    <button
      type="button"
      aria-pressed={picked}
      // Read by `ROW_QUIET`'s group variant, on the SAME element as the skin — which is how the
      // dimmed columns lift out of `muted` once the row is picked, without this passing state on.
      data-selected={picked ? '' : undefined}
      onClick={() => void useGit.getState().pick(picked ? null : commit.hash)}
      className={cn(
        rowSkin(picked),
        'flex h-(--sc-control) w-full items-center gap-2 border-none bg-transparent px-2 text-left',
      )}
    >
      <HistoryGraph row={row} width={width} />
      <span className="text-muted shrink-0 font-mono text-xs">{shortHash(commit.hash)}</span>
      {commit.refs.map(reference => (
        <RefBadge key={`${reference.kind}/${reference.name}`} reference={reference} />
      ))}
      <span className={ROW_SUBJECT}>{commit.message}</span>
      <span className="text-muted w-32 shrink-0 truncate text-xs">{commit.author}</span>
      <span className="text-muted shrink-0 text-xs tabular-nums">
        {formatMoment(commit.at, i18n.language, 'local')}
      </span>
    </button>
  )
})
