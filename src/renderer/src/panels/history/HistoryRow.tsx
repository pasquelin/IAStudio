import { useTranslation } from 'react-i18next'
import { shortHash, type GitCommit } from '@shared/domain/git'
import type { GitLaneRow } from '@shared/domain/gitGraph'
import { rowSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { formatMoment } from '@/helpers/format'
import { HistoryGraph } from './HistoryGraph'
import { RefBadge } from './RefBadge'

export type HistoryRowProps = {
  commit: GitCommit
  row: GitLaneRow
  picked: boolean
  onPick: () => void
}

/**
 * One recorded version, across the width of the band.
 *
 * Four columns and a graph, in the order a history is read: which lane, which commit, what it
 * says, who wrote it, when. The message takes what is left, because it is the only one of the
 * five whose length is the user's own.
 */
export function HistoryRow({ commit, row, picked, onPick }: HistoryRowProps) {
  const { i18n } = useTranslation()

  return (
    <button
      type="button"
      aria-pressed={picked}
      // Read by `ROW_QUIET`'s group variant, on the SAME element as the skin — which is how the
      // dimmed columns lift out of `muted` once the row is picked, without this passing state on.
      data-selected={picked ? '' : undefined}
      onClick={onPick}
      className={cn(
        rowSkin(picked),
        'flex h-(--sc-control) w-full items-center gap-2 border-none bg-transparent px-2 text-left',
      )}
    >
      <HistoryGraph row={row} />
      <span className="text-muted shrink-0 font-mono text-xs">{shortHash(commit.hash)}</span>
      {commit.refs.map(reference => (
        <RefBadge key={`${reference.kind}/${reference.name}`} reference={reference} />
      ))}
      <span className="text-text min-w-0 flex-1 truncate text-xs">{commit.message}</span>
      <span className="text-muted w-32 shrink-0 truncate text-xs">{commit.author}</span>
      <span className="text-muted shrink-0 text-xs tabular-nums">
        {formatMoment(commit.at, i18n.language, 'local')}
      </span>
    </button>
  )
}
