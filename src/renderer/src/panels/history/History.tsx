import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { toolIcon } from '@/helpers/toolRegistry'
import { useGitHistory } from '@/hooks/useGitHistory'
import { useGit } from '@/stores/git'
import { CommitFiles } from './CommitFiles'
import { DiffPane } from './DiffPane'
import { HistoryList } from './HistoryList'

/**
 * The versions recorded in the project folder, across every branch.
 *
 * The states before `ready` are said in one line here rather than repeated in full: the Git panel
 * is looking at the same folder and carries the screen that explains them, with the button that
 * acts on them. Saying it twice over one folder would be saying it twice.
 */
export function History() {
  const { t } = useTranslation()
  const { repository, commits } = useGitHistory()
  const picked = useGit(state => state.picked)
  const pickedFiles = useGit(state => state.pickedFiles)

  if (repository.kind !== 'ready') {
    return <EmptyState icon={toolIcon('history')} message={t('git.historyUnavailable')} />
  }

  if (commits.length === 0) {
    return <EmptyState icon={toolIcon('history')} message={t('git.historyEmpty')} />
  }

  return (
    <div className="flex min-h-0 flex-1">
      <HistoryList commits={commits} />

      {picked !== null && (
        <div className="border-border w-64 shrink-0 border-l">
          <CommitFiles files={pickedFiles} commit={picked} />
        </div>
      )}

      {/* Draws nothing until a file is being compared — and the file may have been picked in the
          Git panel, which is why this is here rather than beside the column above. */}
      <DiffPane />
    </div>
  )
}
