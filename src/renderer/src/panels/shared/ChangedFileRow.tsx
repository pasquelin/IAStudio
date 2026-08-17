import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GIT_CHANGE_BADGES, type GitCommitFile } from '@shared/domain/git'
import { nameOf, parentOf } from '@shared/domain/folder'
import { Row } from '@/design/Row'
import { TONE_TEXT, type StatusTone } from '@/design/styles'
import { cn } from '@/helpers/cn'

/**
 * How each change reads, in ink.
 *
 * `danger` is spent on the two that LOSE something — a file git will drop, and a file two sides
 * disagree about. A modification is not a warning, and painting it as one would leave nothing to
 * paint the two that are.
 */
const TONES: Record<GitCommitFile['change'], StatusTone> = {
  added: 'success',
  modified: 'accent',
  deleted: 'danger',
  renamed: 'accent',
  copied: 'accent',
  untracked: 'muted',
  conflicted: 'danger',
}

export type ChangedFileRowProps = {
  file: GitCommitFile
  /** What goes before the badge — the tick, on a file the next version can still be told about. */
  leading?: ReactNode
  actions?: ReactNode
}

/**
 * One changed file, wherever it is read: waiting in the working tree, or inside a recorded
 * version. The two panels differ in what they let you DO with the row, never in how it reads —
 * written twice, they drifted on the one thing a reader compares across them, the badge's ink.
 */
export function ChangedFileRow({ file, leading, actions }: ChangedFileRowProps) {
  const { t } = useTranslation()

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
          {leading}
          {/* Git's own letter, from `shared/` and not from a bundle: `M` is `M` in French, and
              the seven of them in two locale files are seven values a translator is right to
              leave alone and wrong to touch. The row's HINT is what says the change in words. */}
          <span
            aria-hidden
            className={cn('w-3 text-center font-mono text-xs', TONE_TEXT[TONES[file.change]])}
          >
            {GIT_CHANGE_BADGES[file.change]}
          </span>
        </span>
      }
      actions={actions}
    />
  )
}
