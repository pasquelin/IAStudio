import { mdiCloudDownloadOutline, mdiCloudUploadOutline, mdiSync } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { GitStatus } from '@shared/domain/git'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * What is waiting to come down and to go up, and the three gestures that move it.
 *
 * The counts are drawn ONLY when they are not zero. A pair of zeroes beside every branch name is
 * two more numbers to read on a row that already carries one, and it says nothing a user needed
 * to know: what one wants to see at a glance is that there IS something waiting.
 */
export function RemoteBar({ status }: { status: GitStatus }) {
  const { t } = useTranslation()
  const busy = useGit(state => state.busy)
  const fetch = useGit(state => state.fetch)
  const pull = useGit(state => state.pull)
  const push = useGit(state => state.push)

  return (
    <>
      {status.behind > 0 && (
        <span className="text-muted text-tiny shrink-0 tabular-nums">
          {t('git.behind', { commits: status.behind })}
        </span>
      )}
      {status.ahead > 0 && (
        <span className="text-muted text-tiny shrink-0 tabular-nums">
          {t('git.ahead', { commits: status.ahead })}
        </span>
      )}

      <ToolButton
        icon={mdiSync}
        label={t('git.fetch')}
        description={t('git.fetchHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={busy}
        onClick={() => void fetch()}
      />
      <ToolButton
        icon={mdiCloudDownloadOutline}
        label={t('git.pull')}
        description={t('git.pullHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={busy || status.behind === 0}
        onClick={() => void pull()}
      />
      <ToolButton
        icon={mdiCloudUploadOutline}
        label={t('git.push')}
        description={t('git.pushHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        // Offered with nothing ahead when the branch tracks NOTHING: that first push is what
        // creates the branch on the server, and refusing it would leave no way to make one.
        disabled={busy || (status.ahead === 0 && status.upstream !== null)}
        onClick={() => void push(status.upstream === null)}
      />
    </>
  )
}
