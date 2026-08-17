/**
 * What changed inside one file, read out of git's unified diff.
 *
 * Parsing, and nothing else — no colours, no widths, no DOM. The format is stable, exactly
 * specified, and the one place a mistake shows up as lines attributed to the wrong side, which
 * is why it is checked here rather than looked at on screen.
 */

export type GitDiffSide = 'added' | 'removed' | 'context'

export type GitDiffLine = {
  side: GitDiffSide
  text: string
  /** Line number in the earlier version, or nothing for a line that did not exist there. */
  before: number | null
  /** Line number in the later version, or nothing for a line that no longer exists. */
  after: number | null
}

export type GitDiffHunk = {
  /** Git's own `@@ … @@` line, which often carries the enclosing function's name. */
  header: string
  lines: readonly GitDiffLine[]
}

/**
 * A file's changes, or the reason there are none to read.
 *
 * `binary` is not a failure: git says so itself for anything it cannot line up, which for this
 * studio is most of a project. What the panel does with it is show the two versions as pictures,
 * which is the comparison that was wanted in the first place.
 */
export type GitDiff =
  { kind: 'text'; hunks: readonly GitDiffHunk[] } | { kind: 'binary' } | { kind: 'empty' }

/** `@@ -12,7 +12,9 @@ optional context` — the two starting line numbers are what is needed. */
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parseUnifiedDiff(output: string): GitDiff {
  if (/^(Binary files|GIT binary patch)/m.test(output)) return { kind: 'binary' }

  const hunks: GitDiffHunk[] = []
  let hunk: { header: string; lines: GitDiffLine[] } | null = null
  let before = 0
  let after = 0

  for (const line of output.split('\n')) {
    const opened = HUNK.exec(line)
    if (opened) {
      hunk = { header: line, lines: [] }
      hunks.push(hunk)
      before = Number(opened[1])
      after = Number(opened[2])
      continue
    }

    // Everything before the first `@@` is the header git writes about the file itself — which
    // path, which mode, which blobs. The panel already knows the path; none of it is content.
    if (!hunk) continue

    // "\ No newline at end of file" is a note ABOUT the line above, not a line of the file. Left
    // out rather than shown: it would read as a removal that nobody made.
    if (line.startsWith('\\')) continue

    if (line.startsWith('+')) {
      hunk.lines.push({ side: 'added', text: line.slice(1), before: null, after })
      after += 1
    } else if (line.startsWith('-')) {
      hunk.lines.push({ side: 'removed', text: line.slice(1), before, after: null })
      before += 1
    } else if (line.startsWith(' ')) {
      hunk.lines.push({ side: 'context', text: line.slice(1), before, after })
      before += 1
      after += 1
    }
  }

  return hunks.length === 0 ? { kind: 'empty' } : { kind: 'text', hunks }
}

/**
 * How many lines the diff adds and takes away — the two numbers a summary is made of.
 *
 * Here rather than counted at the drawing, because two surfaces want them and a count computed
 * twice is a count that can disagree with itself.
 */
export function diffTally(diff: GitDiff): { added: number; removed: number } {
  if (diff.kind !== 'text') return { added: 0, removed: 0 }

  const lines = diff.hunks.flatMap(hunk => hunk.lines)
  return {
    added: lines.filter(line => line.side === 'added').length,
    removed: lines.filter(line => line.side === 'removed').length,
  }
}
