import { mdiSourceBranch } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { hasChanges, type GitStatus } from '@shared/domain/git'
import { QuietNote } from '@/design/QuietNote'
import { UiIcon } from '@/design/UiIcon'
import { PANEL_SCROLL } from '@/design/styles'
import { GitFiles } from './GitFiles'

/** The folder as git sees it: which branch, and what has moved since the last recorded version. */
export function GitReady({ status }: { status: GitStatus }) {
  const { t } = useTranslation()

  return (
    <div className={PANEL_SCROLL}>
      <div className="border-border text-text flex items-center gap-2 border-b px-2 py-1 text-xs">
        <UiIcon path={mdiSourceBranch} size={14} className="text-muted shrink-0" />
        <span className="truncate">{status.branch ?? t('git.detached')}</span>
        {/* Said only before the first commit. A repository with a history says its branch and
            nothing else — the history itself is the other panel's business. */}
        {status.head === null && (
          <span className="text-muted text-tiny shrink-0">{t('git.noCommitYet')}</span>
        )}
      </div>

      {hasChanges(status) ? (
        <GitFiles status={status} />
      ) : (
        <QuietNote standalone>{t('git.clean')}</QuietNote>
      )}
    </div>
  )
}
