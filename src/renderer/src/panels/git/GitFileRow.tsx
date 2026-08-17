import {
  mdiArrowLeftBoldOutline,
  mdiArrowRightBoldOutline,
  mdiFileCompare,
  mdiUndoVariant,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { canRestore, type GitFile } from '@shared/domain/git'
import { nameOf, parentOf } from '@shared/domain/folder'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { TONE_TEXT, type StatusTone } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { revealTool } from '@/helpers/revealPanel'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * How each change reads, in ink.
 *
 * `danger` is spent on the two that LOSE something — a file git will drop, and a file two sides
 * disagree about. A modification is not a warning, and painting it as one would leave nothing to
 * paint the two that are.
 */
const TONES: Record<GitFile['change'], StatusTone> = {
  added: 'success',
  modified: 'accent',
  deleted: 'danger',
  renamed: 'accent',
  copied: 'accent',
  untracked: 'muted',
  conflicted: 'danger',
}

/**
 * One changed file.
 *
 * The tick IS the index, which is the gesture every version tool has settled on: ticking a file
 * adds it to what the next commit will record, unticking takes it back out. No separate pair of
 * buttons, and no selection of its own to keep in step with what git thinks.
 */
export function GitFileRow({ file }: { file: GitFile }) {
  const { t } = useTranslation()
  const busy = useGit(state => state.busy)
  const stage = useGit(state => state.stage)
  const unstage = useGit(state => state.unstage)
  const restore = useGit(state => state.restore)
  const compare = useGit(state => state.compare)
  const resolve = useGit(state => state.resolve)

  return (
    <Row
      title={nameOf(file.path)}
      subtitle={parentOf(file.path) ?? undefined}
      hint={
        file.from === undefined
          ? `${file.path} · ${t(`git.change.${file.change}`)}`
          : `${file.from} → ${file.path}`
      }
      leading={
        <span className="flex shrink-0 items-center gap-2">
          <input
            type="checkbox"
            className="size-3"
            checked={file.stage === 'staged'}
            disabled={busy}
            aria-label={file.path}
            onChange={event => void (event.target.checked ? stage : unstage)([file.path])}
          />
          <span
            aria-hidden
            className={cn('w-3 text-center font-mono text-xs', TONE_TEXT[TONES[file.change]])}
          >
            {t(`git.changeBadge.${file.change}`)}
          </span>
        </span>
      }
      actions={
        <>
          {/* A conflict is settled BEFORE anything else can happen with the file, so its two
              buttons stand in front of the ordinary ones — and the ordinary ones are withheld:
              comparing a file whose two versions are both in it says nothing. */}
          {file.stage === 'conflicted' ? (
            <>
              <ToolButton
                icon={mdiArrowLeftBoldOutline}
                label={t('git.keepOurs', { name: file.path })}
                description={t('git.keepOursHint')}
                tooltip={TIP_LEFT}
                variant="row"
                disabled={busy}
                onClick={() => void resolve([file.path], 'ours')}
              />
              <ToolButton
                icon={mdiArrowRightBoldOutline}
                label={t('git.keepTheirs', { name: file.path })}
                description={t('git.keepTheirsHint')}
                tooltip={TIP_LEFT}
                variant="row"
                disabled={busy}
                onClick={() => void resolve([file.path], 'theirs')}
              />
            </>
          ) : null}

          {/* Asked here and answered in the band. This column is a side panel and a diff is read
              ACROSS — so the click sets what to compare and brings the wide panel forward.
              Withheld on a conflict: a file holding both versions at once compares to nothing. */}
          {file.stage !== 'conflicted' && (
            <ToolButton
              icon={mdiFileCompare}
              label={t('git.compareFile', { name: file.path })}
              description={t('git.compareHint')}
              tooltip={TIP_LEFT}
              variant="row"
              disabled={busy}
              onClick={() => {
                void compare(file.path, null)
                revealTool('history')
              }}
            />
          )}

          {canRestore(file) && (
            <ToolButton
              icon={mdiUndoVariant}
              // Named for its FILE, not for the gesture. A panel with six changed files carried
              // six buttons a reader heard as « Restaurer » six times over, with nothing to tell
              // them apart — and no way to know which one was about to be undone.
              label={t('git.restoreFile', { name: file.path })}
              description={t('git.restoreHint')}
              tooltip={TIP_LEFT}
              variant="row"
              disabled={busy}
              onClick={() => void restore([file.path])}
            />
          )}
        </>
      }
    />
  )
}
