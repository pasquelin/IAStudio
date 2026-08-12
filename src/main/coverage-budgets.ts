/**
 * What a coverage budget grants beyond what its glob carries, and when that becomes too much.
 *
 * Under `src/main` for the reason `coverage-thresholds.test.ts` gives about the same file: it
 * guards the config at the repository root, and `src/shared` compiles for the renderer. Nothing
 * of the application imports it — `scripts/coverage-slack.mjs` does, the way
 * `collect-licences.mjs` imports `shared/domain/licence.ts`, so the rule the tests check is the
 * one that runs.
 */

/** One budget as `vitest.config.ts` declares it. Negative counts uncovered items allowed. */
export type Budget = {
  glob: string
  statements: number
  branches: number
}

/** Uncovered items a glob holds, or the room left between a budget and them. */
export type Counts = {
  statements: number
  branches: number
}

/** A glob with the room its budget has left. Positive is granted, negative is a red gate. */
export type Slack = Counts & { glob: string }

/** The shape `coverage-summary.json` gives per file, reduced to what this reads. */
export type Summary = Record<string, { statements: Tally; branches: Tally }>

type Tally = { total: number; covered: number }

/**
 * How far a budget may sit above what its glob actually carries.
 *
 * Raising a budget is the cheap way out of a red gate — cheaper than writing the test the red was
 * asking for. On 11 August four raises in one evening took `panels/**` from 147 to 215 in steps of
 * +45 and +40, and the batch that finally tripped the gate was not the one that had eaten the
 * room. Thirty sits below both of those raises.
 *
 * It sits above every slack the repository carries — but only since this guard first ran. The two
 * budgets Prettier had wrapped across lines were invisible to its first parser and held **137 and
 * 131** of room; they came down to what they measure in the same batch. Before that the widest
 * slack looked like 26, which is how a ceiling gets chosen against a figure nobody could see.
 *
 * It bounds the STEP, not the total: a glob may be far from its budget for good reasons — a canvas
 * jsdom cannot paint, a WebGL context — but nobody should grant that room without saying so.
 *
 * **No test holds this number**: raising it disarms the guard and every case stays green. That is
 * a review's job, which is why it carries its two measurements rather than standing bare.
 */
export const MAX_SLACK = 30

/**
 * How few budgets mean the parser has lost its footing rather than the config having shrunk.
 *
 * A guard that reads nothing passes everything, which is the failure this whole file exists to
 * prevent — `coverage-thresholds.test.ts` defends itself the same way. Twenty-one is what the
 * config declares today, this file's own budget included; a batch that genuinely removes one
 * lowers this line and says why, and a batch that adds one raises it.
 *
 * **Like `MAX_SLACK`, no test holds this number** — the wiring itself IS held, one file over.
 * And this one is the easier of the two to
 * lower, since the sentence above invites it. A case does check that the real config still
 * declares at least this many, so lowering it silently while the parser rots is what a review
 * has to catch.
 */
export const LEAST_BUDGETS = 21

/**
 * The budgets alone — the thresholds written as a negative count of uncovered items, which are
 * the only ones with room to measure. A `100` is a percentage and has none.
 */
export function budgetsIn(config: string): Budget[] {
  return declaredIn(config).filter(budget => budget.statements < 0)
}

/**
 * Every glob the config names, the percentages included — a wider list than `budgetsIn`, and the
 * one the rename check needs.
 *
 * A threshold of `100` carries no room to measure, which is why the slack table leaves it out. It
 * is still a glob that can stop matching, and the one where that costs most: "nothing may go
 * uncovered" over a folder that no longer exists asks nothing of anybody, and reads green.
 */
export function globsIn(config: string): string[] {
  return declaredIn(config).map(budget => budget.glob)
}

/**
 * Every threshold, read off the config as text rather than imported — importing it would run the
 * config, plugins included, for a handful of numbers.
 *
 * Comments are stripped first, exactly as `coverage-thresholds.test.ts` does on the same file:
 * this rule is explained in prose nearby, so a quoted budget would be read as a declared one.
 * The two keys Prettier wraps across lines are why `statements` and `branches` are matched apart
 * rather than as one shape — reading 18 of 20 is how a guard goes blind without a word.
 */
function declaredIn(config: string): Budget[] {
  const bare = config
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')

  const entries = /'([^']+)':\s*\{([^}]*)\}/g
  return [...bare.matchAll(entries)].map(match => ({
    glob: match[1] ?? '',
    statements: Number(match[2]?.match(/statements:\s*(-?\d+)/)?.[1]),
    branches: Number(match[2]?.match(/branches:\s*(-?\d+)/)?.[1]),
  }))
}

/**
 * Whether a path falls under a glob, for the three shapes the config uses: a trailing `**`, a
 * braced alternation, and a plain file path.
 *
 * Written here rather than taken from `picomatch`: it ships as a transitive dependency of vitest
 * and nothing declares it, so reaching for it would bind this to somebody else's tree. Checked
 * against it once over all 23 globs and 1311 source files — no disagreement.
 */
export function matches(path: string, glob: string): boolean {
  const alternation = glob.match(/\{([^}]*)\}/)
  if (alternation) {
    const parts = alternation[1] ?? ''
    return parts.split(',').some(part => matches(path, glob.replace(alternation[0], part.trim())))
  }

  return glob.endsWith('/**') ? path.startsWith(glob.slice(0, -2)) : path === glob
}

/** Uncovered statements and branches a glob holds, summed over the files under it. */
export function carried(summary: Summary, glob: string, root: string): Counts {
  let statements = 0
  let branches = 0

  for (const [path, counts] of Object.entries(summary)) {
    if (path === 'total') continue
    const relative = path.startsWith(root) ? path.slice(root.length) : path
    if (!matches(relative, glob)) continue

    statements += counts.statements.total - counts.statements.covered
    branches += counts.branches.total - counts.branches.covered
  }

  return { statements, branches }
}

/** Each budget with the room left between it and what its glob carries. */
export function slackOf(config: string, summary: Summary, root: string): Slack[] {
  return budgetsIn(config).map(budget => {
    const held = carried(summary, budget.glob, root)
    return {
      glob: budget.glob,
      statements: -budget.statements - held.statements,
      branches: -budget.branches - held.branches,
    }
  })
}

/** The globs whose budget sits further above what they carry than `max` allows. */
export function granted(rows: Slack[], max: number): Slack[] {
  return rows.filter(row => row.statements > max || row.branches > max)
}

/**
 * A glob no file matches, which is how a budget stops guarding without being removed.
 *
 * `vitest.config.ts` names the trap itself — "a glob matching nothing passes silently. Renaming a
 * folder turns its budget into a no-op". A renamed glob is also the one contortion the slack
 * ceiling cannot catch: it reads as room, and a tight budget stays under thirty.
 *
 * Takes globs rather than the slack table it once read: that table holds only the budgets, so the
 * three globs asking for full coverage were the ones this never looked at.
 */
export function unmatched(globs: string[], summary: Summary, root: string): string[] {
  return globs.filter(
    glob => !Object.keys(summary).some(path => matches(path.replace(root, ''), glob)),
  )
}
