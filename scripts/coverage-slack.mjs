import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * How far a budget may sit above what its glob actually carries.
 *
 * A budget is a number of uncovered items a folder may hold, and raising one is the cheap way
 * out of a red gate — cheaper than writing the test the red was asking for. On 11 August four
 * raises in one evening took `panels/**` from 147 to 215 in steps of **+45 and +40**, while the
 * widest slack any glob legitimately carries is 26 (`hooks/**`, measured the same day). Thirty
 * sits between the two: no honest budget trips it, and neither of that evening's raises would
 * have passed.
 *
 * It bounds the STEP, not the total: a glob may be far from its budget for good reasons — a
 * canvas jsdom cannot paint, a WebGL context — but nobody should be able to grant that room
 * without saying so.
 */
export const MAX_SLACK = 30

/** Where vitest writes the summary this reads. Kept here so the runner and the guard agree. */
export const SUMMARY = join('coverage', 'coverage-summary.json')

/**
 * The thresholds, read off the config as text rather than imported.
 *
 * Importing it would run the config — plugins included — for four numbers. Comments are stripped
 * first, exactly as `src/main/coverage-thresholds.test.ts` does on the same file: this one
 * explains budgets, so a sentence quoting one would be read as one.
 */
export function budgetsIn(config) {
  const bare = config
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')

  const pattern = /'([^']+)':\s*\{\s*statements:\s*(-?\d+),\s*branches:\s*(-?\d+)\s*\}/g
  return [...bare.matchAll(pattern)]
    .map(([, glob, statements, branches]) => ({
      glob,
      statements: Number(statements),
      branches: Number(branches),
    }))
    .filter(budget => budget.statements < 0)
}

/**
 * Whether a path falls under a glob, for the three shapes the config uses: a trailing `**`, a
 * braced alternation, and a plain file path.
 *
 * Written here rather than taken from `picomatch`: it ships as a transitive dependency of vitest
 * and nothing declares it, so reaching for it would bind this guard to somebody else's tree.
 */
export function matches(path, glob) {
  const alternation = glob.match(/\{([^}]*)\}/)
  if (alternation) {
    return alternation[1]
      .split(',')
      .some(part => matches(path, glob.replace(alternation[0], part.trim())))
  }

  return glob.endsWith('/**') ? path.startsWith(glob.slice(0, -2)) : path === glob
}

/** Uncovered statements and branches a glob holds, summed over the files under it. */
export function carried(summary, glob, root) {
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

/** Each budget with what its glob carries and the room left between the two. */
export function slackOf(config, summary, root) {
  return budgetsIn(config).map(budget => {
    const held = carried(summary, budget.glob, root)
    return {
      glob: budget.glob,
      statements: -budget.statements - held.statements,
      branches: -budget.branches - held.branches,
    }
  })
}

function report(rows) {
  const width = Math.max(...rows.map(row => row.glob.length))
  for (const row of rows) {
    const slack = `${row.statements}/${row.branches}`
    const over = row.statements > MAX_SLACK || row.branches > MAX_SLACK
    process.stdout.write(`  ${row.glob.padEnd(width)}  ${slack.padStart(9)}${over ? '  ⚠' : ''}\n`)
  }
}

// Guarded, so the test that imports these functions does not run the guard: this reads a report
// that only exists after a coverage run, and importing it would fail before writing a line.
if (import.meta.main) {
  const root = `${process.cwd()}/`
  const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'))
  const rows = slackOf(readFileSync('vitest.config.ts', 'utf8'), summary, root)

  process.stdout.write('\nCoverage budgets, and the room each has left:\n')
  report(rows)

  const granted = rows.filter(row => row.statements > MAX_SLACK || row.branches > MAX_SLACK)
  if (granted.length > 0) {
    const names = granted.map(row => row.glob).join(', ')
    process.stderr.write(
      `\nERROR: ${names} sit more than ${MAX_SLACK} above what they carry.\n` +
        `A budget that far ahead is room nobody decided to grant — lower it to the measured\n` +
        `value, or say in vitest.config.ts what the room is for.\n`,
    )
    process.exit(1)
  }
}
