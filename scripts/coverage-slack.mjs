import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// A `.ts` from a `.mjs`, as `collect-licences.mjs` does: Node 24 strips the types on the way in,
// and the rule the tests check is then the one that runs rather than a twin of it.
import {
  granted,
  LEAST_BUDGETS,
  MAX_SLACK,
  slackOf,
  unmatched,
  budgetsIn,
} from '../src/main/coverage-budgets.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUMMARY = join(ROOT, 'coverage', 'coverage-summary.json')
const CONFIG = join(ROOT, 'vitest.config.ts')

function report(rows) {
  const width = Math.max(...rows.map(row => row.glob.length))
  for (const row of rows) {
    const room = `${row.statements}/${row.branches}`
    const over = granted([row], MAX_SLACK).length > 0
    process.stdout.write(`  ${row.glob.padEnd(width)}  ${room.padStart(9)}${over ? '  ⚠' : ''}\n`)
  }
}

function fail(message) {
  process.stderr.write(`\nERROR: ${message}\n`)
  process.exit(1)
}

// The same idiom as `fetch-ffmpeg.mjs` and `fetch-stt.mjs`: `import.meta.main` needs Node 24.2,
// and `package.json` declares no engine. Guarded at all so the test can import the module.
if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const config = readFileSync(CONFIG, 'utf8')
  const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'))
  const budgets = budgetsIn(config)

  if (budgets.length < LEAST_BUDGETS) {
    fail(
      `read ${budgets.length} budgets from vitest.config.ts, expected at least ${LEAST_BUDGETS}.\n` +
        `A guard that reads nothing passes everything. Either budgets were removed — lower\n` +
        `LEAST_BUDGETS and say why — or this parser no longer understands how they are written.`,
    )
  }

  const rows = slackOf(config, summary, `${ROOT}/`)
  process.stdout.write(`\nCoverage budgets (${rows.length}), and the room each has left:\n`)
  report(rows)

  const empty = unmatched(rows, summary, `${ROOT}/`)
  if (empty.length > 0) {
    fail(
      `${empty.join(', ')} match no file at all.\n` +
        `A glob that matches nothing passes silently, which is what renaming a folder does to\n` +
        `its budget. Point it at what it was guarding, or remove it and say so.`,
    )
  }

  const over = granted(rows, MAX_SLACK)
  if (over.length > 0) {
    fail(
      `${over.map(row => row.glob).join(', ')} sit more than ${MAX_SLACK} above what they carry.\n` +
        `A budget that far ahead is room nobody decided to grant — lower it to the measured\n` +
        `value, or say in vitest.config.ts what the room is for.`,
    )
  }
}
