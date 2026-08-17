import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GIT_CHANGE_BADGES, type GitCommitFile } from '@shared/domain/git'
import { Row } from '@/design/Row'
import { rowSkin, TONE_TEXT, type StatusTone } from '@/design/styles'
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
  /** The row being looked at, where the list has one — the file a comparison is showing. */
  selected?: boolean
}

/**
 * One changed file, wherever it is read: waiting in the working tree, or inside a recorded
 * version. The two panels differ in what they let you DO with the row, never in how it reads —
 * written twice, they drifted on the one thing a reader compares across them, the badge's ink.
 */
export function ChangedFileRow({ file, leading, actions, selected }: ChangedFileRowProps) {
  const { t } = useTranslation()

  return (
    // A HEIGHT and `rowSkin` — the radius and the fill a picked line wears — which is what `Tree`
    // gives a row and what these two panels gave none: the line had no height of its own (`Row`
    // is `h-full`, and a list answers that with a row of its own) and came out at 198px each, one
    // file per screenful. Not `ROW_LINE` on top of it: `Row` already wears that, and the two
    // paddings stacked put every name 4px past the heading above it.
    //
    // The height is a CONTROL's, the gauge every list in the studio measures by: the path is one
    // line clipped at its start, not a name stacked over its folder. `Tree` settled that same
    // question for the explorer on 14 August.
    <div
      // On the SAME element as the skin, which is how `Row` lifts its title out of `muted` when
      // the line is picked — `rowSkin` reads it through a group, and a step apart it reads nothing.
      data-selected={selected ? '' : undefined}
      className={cn('flex h-(--sc-control) items-center', rowSkin(selected ?? false))}
    >
      <Row
        // The PATH, not the name: which `etude.jpg` moved is the question a version panel is
        // read for, and the folder was the answer sitting on a second line. Clipped at the
        // start, so what goes when the panel is narrow is the folder rather than the file.
        title={file.path}
        clip="start"
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
    </div>
  )
}
