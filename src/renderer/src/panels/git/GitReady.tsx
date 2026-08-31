import { useTranslation } from 'react-i18next'
import { hasChanges, type GitStatus } from '@shared/domain/git'
import { QuietNote } from '@/components/QuietNote'
import { PANEL_BAR, PANEL_SCROLL } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { useGit } from '@/stores/git'
import { CommitBox } from './CommitBox'
import { GitBranchButton } from './GitBranchButton'
import { GitFiles } from './GitFiles'
import { RemoteBar } from './RemoteBar'
import { RemoteSetup } from './RemoteSetup'
import { StashButton } from './StashButton'

/** The folder as git sees it: which branch, what to record, and what has moved since the last. */
export function GitReady({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const remote = useGit(state => state.remote)

  return (
    // The bar, the field and the box stay PUT; only the list of files scrolls. Two things came of
    // putting the whole panel in one scroller: the box one types a message into left the screen
    // under a long list, and every separator stopped short of the right edge — `PANEL_SCROLL`
    // reserves that strip for the scrollbar, which is right for rows and wrong for a rule meant
    // to cross the panel.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(PANEL_BAR, 'shrink-0 px-1 py-1')}>
        <GitBranchButton status={status} />
        {/* Said only before the first commit. A repository with a history says its branch and
            nothing else — the history itself is the other panel's business. */}
        {status.head === null && (
          <span className="text-muted text-tiny shrink-0">{t('git.noCommitYet')}</span>
        )}
        <StashButton status={status} />
        {remote && <RemoteBar status={status} />}
      </div>

      {/* Offered only once there is a version to send. A field asking where to push, on a folder
          that has recorded nothing, is a question with no answer yet. */}
      {!remote && status.head !== null && <RemoteSetup />}

      <CommitBox status={status} />

      {hasChanges(status) ? (
        <div className={PANEL_SCROLL}>
          <GitFiles status={status} />
        </div>
      ) : (
        <QuietNote standalone>{t('git.clean')}</QuietNote>
      )}
    </div>
  )
}
