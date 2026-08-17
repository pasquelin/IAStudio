import { useTranslation } from 'react-i18next'
import { hasChanges, type GitStatus } from '@shared/domain/git'
import { QuietNote } from '@/design/QuietNote'
import { PANEL_SCROLL } from '@/design/styles'
import { useGit } from '@/stores/git'
import { CommitBox } from './CommitBox'
import { GitBranchButton } from './GitBranchButton'
import { GitFiles } from './GitFiles'
import { RemoteBar } from './RemoteBar'
import { RemoteSetup } from './RemoteSetup'

/** The folder as git sees it: which branch, what to record, and what has moved since the last. */
export function GitReady({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const remote = useGit(state => state.remote)

  return (
    <div className={PANEL_SCROLL}>
      <div className="border-border flex items-center gap-2 border-b px-1 py-1">
        <GitBranchButton status={status} />
        {/* Said only before the first commit. A repository with a history says its branch and
            nothing else — the history itself is the other panel's business. */}
        {status.head === null && (
          <span className="text-muted text-tiny shrink-0">{t('git.noCommitYet')}</span>
        )}
        {remote && <RemoteBar status={status} />}
      </div>

      {/* Offered only once there is a version to send. A field asking where to push, on a folder
          that has recorded nothing, is a question with no answer yet. */}
      {!remote && status.head !== null && <RemoteSetup />}

      <CommitBox status={status} />

      {hasChanges(status) ? (
        <GitFiles status={status} />
      ) : (
        <QuietNote standalone>{t('git.clean')}</QuietNote>
      )}
    </div>
  )
}
