import { mdiSourceBranch } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { GIT_FAILURE_KEYS } from '@shared/domain/git'
import { EmptyState } from '@/design/EmptyState'
import { QuietNote } from '@/design/QuietNote'
import { useGitStatus } from '@/hooks/useGitStatus'
import { useGit } from '@/stores/git'
import { GitReady } from './GitReady'

/**
 * Version control over the PROJECT folder — the user's own files, never this repository's code.
 *
 * Five states rather than one with holes in it, and each is a screen somebody has to be able to
 * act on: no project, no git on this machine, a folder never initialised, a command that failed,
 * and the folder as it stands. The union arrives from the main process already settled, so
 * nothing here has to work out what a missing field would have meant.
 */
export function Git() {
  const { t } = useTranslation()
  const repository = useGitStatus()
  const busy = useGit(state => state.busy)
  const initRepository = useGit(state => state.initRepository)

  switch (repository.kind) {
    case 'no-project':
      return <EmptyState icon={mdiSourceBranch} message={t('git.noProject')} />

    case 'no-binary':
      return <EmptyState icon={mdiSourceBranch} message={t('git.noBinary')} />

    case 'uninitialised':
      return (
        <EmptyState
          icon={mdiSourceBranch}
          message={t('git.uninitialised')}
          // Withdrawn while the command runs rather than disabled: `git init` answers in well
          // under a second, and a button that greys out and comes back reads as a flicker.
          action={
            busy
              ? undefined
              : {
                  label: t('git.start'),
                  hint: t('git.startHint'),
                  onClick: () => void initRepository(),
                }
          }
        />
      )

    case 'failed':
      return (
        <div className="flex flex-col gap-2 p-3">
          <QuietNote>{t(GIT_FAILURE_KEYS[repository.reason])}</QuietNote>
          {/* Git's own line, credentials already stripped in the main process. Kept because a
              named reason still does not say WHICH file or which remote, and for `unknown` it is
              the only thing there is to show at all. */}
          {repository.detail !== '' && (
            <pre className="text-muted text-tiny m-0 break-words whitespace-pre-wrap">
              {repository.detail}
            </pre>
          )}
        </div>
      )

    default:
      return <GitReady status={repository.status} />
  }
}
