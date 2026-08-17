import type { GitDiffHunk, GitDiffLine } from '@shared/domain/gitDiff'
import { cn } from '@/helpers/cn'

/**
 * How each side reads.
 *
 * The INK, not a tint behind the line. A tinted row is the shape a diff is usually read by, and
 * it would want two background tokens the studio does not have — `accent-soft` is the only soft
 * one, and inventing two more means pinning two colours against every surface and every theme,
 * which `design/tokens.test.ts` is right to make expensive. Both of these are already measured.
 */
const SIDES: Record<GitDiffLine['side'], string> = {
  added: 'text-success',
  removed: 'text-danger',
  context: 'text-muted',
}

/** The sign every diff has been read by since diffs existed. Decorative here: the ink says it. */
const MARKS: Record<GitDiffLine['side'], string> = {
  added: '+',
  removed: '-',
  context: ' ',
}

/** What changed inside one text file, hunk by hunk, with the line numbers of both versions. */
export function DiffText({ hunks }: { hunks: readonly GitDiffHunk[] }) {
  return (
    <div className="font-mono text-xs">
      {hunks.map(hunk => (
        <section key={hunk.header}>
          <div className="bg-elevated text-muted px-2 py-1">{hunk.header}</div>

          {hunk.lines.map((line, index) => (
            // The index belongs in the key: the same text can legitimately appear twice in one
            // hunk — a blank line, a closing brace — and nothing else tells the two apart.
            <div key={`${index}-${line.text}`} className={cn('flex gap-2 px-2', SIDES[line.side])}>
              <span className="text-muted w-8 shrink-0 text-right tabular-nums">
                {line.before ?? ''}
              </span>
              <span className="text-muted w-8 shrink-0 text-right tabular-nums">
                {line.after ?? ''}
              </span>
              <span aria-hidden className="w-2 shrink-0">
                {MARKS[line.side]}
              </span>
              <span className="break-all whitespace-pre-wrap">{line.text}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
