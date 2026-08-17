import { useTranslation } from 'react-i18next'
import { hasChanges, type GitStatus } from '@shared/domain/git'
import { QuietNote } from '@/design/QuietNote'
import { PANEL_SCROLL } from '@/design/styles'
import { CommitBox } from './CommitBox'
import { GitBranchButton } from './GitBranchButton'
import { GitFiles } from './GitFiles'

/** The folder as git sees it: which branch, what to record, and what has moved since the last. */
export function GitReady({ status }: { status: GitStatus }) {
  const { t } = useTranslation()

  return (
    <div className={PANEL_SCROLL}>
      <div className="border-border flex items-center gap-2 border-b px-1 py-1">
        <GitBranchButton status={status} />
        {/* Said only before the first commit. A repository with a history says its branch and
            nothing else — the history itself is the other panel's business. */}
        {status.head === null && (
          <span className="text-muted text-tiny shrink-0">{t('git.noCommitYet')}</span>
        )}
      </div>

      <CommitBox status={status} />

      {hasChanges(status) ? (
        <GitFiles status={status} />
      ) : (
        <QuietNote standalone>{t('git.clean')}</QuietNote>
      )}
    </div>
  )
}
