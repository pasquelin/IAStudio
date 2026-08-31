import { mdiClose } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { diffTally } from '@shared/domain/gitDiff'
import { QuietNote } from '@/components/QuietNote'
import { Spinner } from '@/components/Spinner'
import { ToolButton } from '@/components/ToolButton'
import { PANEL_BAR, PANEL_SCROLL, ROW_SUBJECT } from '@/components/styles'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'
import { DiffImages } from './DiffImages'
import { DiffText } from './DiffText'

/**
 * What changed inside one file, in the only zone wide enough to show it.
 *
 * Both panels send work here: the Git panel compares a file about to be recorded, the History
 * panel a file inside a version. Which one asked is not a distinction this makes — a file and a
 * version to compare it against is the whole of the question.
 */
export function DiffPane() {
  const { t } = useTranslation()
  const compared = useGit(state => state.compared)
  const diff = useGit(state => state.diff)
  const stopComparing = useGit(state => state.stopComparing)

  if (!compared) return null

  const tally = diffTally(diff)

  return (
    <div className="border-border flex min-h-0 flex-1 flex-col border-l">
      <div className={cn(PANEL_BAR, 'px-2 py-1')}>
        <span className={ROW_SUBJECT} title={compared.path}>
          {compared.path}
        </span>

        {/* Two keys rather than one plural pair: what these say is a SIGNED tally, not a count of
            things — `+3` reads the same whatever the number, in both languages. */}
        {diff?.kind === 'text' && (
          <span className="text-tiny shrink-0 tabular-nums">
            <span className="text-success">{t('git.added', { lines: tally.added })}</span>{' '}
            <span className="text-danger">{t('git.removed', { lines: tally.removed })}</span>
          </span>
        )}

        <ToolButton
          icon={mdiClose}
          label={t('git.stopComparing')}
          tooltip={TIP_LEFT}
          variant="row"
          onClick={stopComparing}
        />
      </div>

      {/* `null` is "git has not answered yet", which is a different screen from "nothing
          changed" — a spinner where an empty note would say the comparison had come back. */}
      {diff === null ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner label={t('git.comparing')} />
        </div>
      ) : diff.kind === 'binary' ? (
        <DiffImages path={compared.path} commit={compared.commit} />
      ) : diff.kind === 'empty' ? (
        <QuietNote standalone>{t('git.compareEmpty')}</QuietNote>
      ) : (
        <div className={PANEL_SCROLL}>
          <DiffText hunks={diff.hunks} />
        </div>
      )}
    </div>
  )
}
