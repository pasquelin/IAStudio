/**
 * The short loop: what `pnpm validate` asks, restricted to what the working tree touched.
 *
 * `validate` is the gate before a merge and stays that. It is not a loop to work in: it runs the
 * whole suite, and paid after every edit of a batch that is the hour a five-minute change turns
 * into.
 *
 * What this runs instead, for a touched component: the tests that transitively import it, the
 * guards no import graph reaches, and the three cached gates — 8,0 s wall clock on an idle
 * machine.
 *
 * The two suites run side by side rather than one after the other, and that was measured rather
 * than assumed: two alternating pairs on 2026-08-13 read 21,7 / 13,5 s sequential against
 * 12,0 / 7,6 s concurrent. A review reading the opposite had timed two lots of 29 files each —
 * the real split is lopsided, a handful of related tests beside the guards, so the small one
 * fills cores the big one leaves idle.
 *
 * It is NOT a replacement for `validate`, and one thing it cannot see says why: a test whose file
 * nothing under `src/` imports.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
// A `.ts` from a `.mjs`, as `check-artefact.mjs` does: Node 24 strips the types on the way in, so
// the rule the tests check is the one that runs rather than a twin of it.
import { LEAST_GUARDS, wideGuardsUnder } from '../src/main/wide-guards.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** A change here moves more than an import graph can follow, so nothing narrower than all of it. */
const RERUN_EVERYTHING = [
  'vitest.config.ts',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'eslint.config.mjs',
  '.prettierrc',
]

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(line => line.length > 0)
}

/**
 * What the tree carries against `since` — staged, unstaged and untracked alike, plus whatever
 * separates `since` from the working tree.
 *
 * The default is HEAD, which is the tight loop: what the last edit touched and nothing else. A
 * batch that commits as it goes has already moved more than that, and HEAD says nothing about it —
 * `pnpm check develop` is what covers a whole batch, and it is what to run before `validate`.
 */
function touchedFiles(since) {
  const seen = new Set([
    ...git('diff', '--name-only', since, '--'),
    ...git('diff', '--name-only', '--cached', '--'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ])
  return [...seen]
}

/** Why these must always run, and why they are detected rather than listed: `wide-guards.ts`. */
function wideGuards() {
  const found = wideGuardsUnder(join(ROOT, 'src')).map(path => relative(ROOT, path))

  if (found.length < LEAST_GUARDS) {
    process.stderr.write(
      `\nERROR: found ${found.length} wide guards, expected at least ${LEAST_GUARDS}.\n` +
        `These are the tests no import graph reaches, so a selection that drops them is green\n` +
        `on a hardcoded word. Either they were removed — lower LEAST_GUARDS and say why — or\n` +
        `the detector in src/main/wide-guards.ts no longer recognises how they read the tree.\n`,
    )
    process.exit(1)
  }
  return found
}

function run(label, command, args) {
  const started = Date.now()
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const done = code => resolve({ label, code, output, seconds: (Date.now() - started) / 1000 })

    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    // An `error` event with no listener throws, which would take the whole run down and lose the
    // output of every gate still in flight — for a binary missing from PATH.
    child.on('error', failure => {
      output += `${failure.message}\n`
      done(1)
    })
    child.on('close', done)
  })
}

function report(results) {
  process.stdout.write('\n')
  for (const { label, code, seconds } of results) {
    const mark = code === 0 ? '✓' : '✗'
    process.stdout.write(`  ${mark} ${label.padEnd(28)} ${seconds.toFixed(1).padStart(6)} s\n`)
  }

  const failed = results.filter(result => result.code !== 0)
  for (const result of failed) {
    process.stdout.write(`\n──── ${result.label} ────\n${result.output}\n`)
  }

  process.stdout.write(
    failed.length === 0
      ? '\nThe short loop is green. `pnpm validate` is still the gate before a merge:\n' +
          'a test no file under src/ imports is reached by a whole run and by nothing else.\n\n'
      : `\n${failed.length} of ${results.length} failed.\n\n`,
  )
  return failed.length === 0 ? 0 : 1
}

async function main(since) {
  let touched
  try {
    touched = touchedFiles(since)
  } catch (failure) {
    // Git's own words, not a guess: this catches a missing binary and a corrupt index too, and
    // naming the revision for those sends the reader hunting a typo they never made.
    const complaint = String(failure.stderr ?? failure.message).trim()
    process.stderr.write(`\nERROR: git failed while reading what changed since '${since}'.\n`)
    process.stderr.write(`${complaint}\n\n`)
    return 1
  }

  // `.html` belongs here: `index.html` carries the Content-Security-Policy, and leaving it out
  // made a weakened CSP report "nothing to check" and exit green — found in review on
  // 2026-08-13. Nothing imports it, so `csp.test.ts` catches it as a wide guard rather than
  // through `related`.
  const sources = touched.filter(path => /^src\/.*\.(ts|tsx|css|json|html)$/.test(path))
  const wholeSuite = touched.some(path => RERUN_EVERYTHING.includes(path))

  if (sources.length === 0 && !wholeSuite) {
    process.stdout.write(
      `\nNothing under src/ has changed against ${since}. There is nothing to check.\n\n`,
    )
    return 0
  }

  process.stdout.write(`\nAgainst ${since}: ${sources.length} file(s) touched under src/.\n`)
  if (wholeSuite) {
    process.stdout.write('A config file moved, so the whole suite runs rather than a selection.\n')
  }

  // `wideGuards()` inside the branch that uses it: on the whole-suite path it would walk every
  // test file under `src/` to build a list nothing then reads.
  const suites = wholeSuite
    ? [run('tests (whole suite)', 'npx', ['vitest', 'run'])]
    : [
        run('tests (related)', 'npx', ['vitest', 'related', '--run', ...sources]),
        run('tests (wide guards)', 'npx', ['vitest', 'run', ...wideGuards()]),
      ]

  // The cached gates alongside the suites: they read a cache under `node_modules/.cache/` and cost
  // a second each warm, so nothing is gained by holding them back. The cache locations are the
  // ones `package.json` writes, never a second set: a run under a different location leaves the
  // gate's own cache cold, which is the ten seconds it exists to save.
  //
  // Only what is still on disk — git reports a deleted path like any other, and both tools exit 2
  // on a file that is gone, failing the loop for the very change that most needs a clean answer.
  //
  // Two lists rather than one, because the two gates cover different files: `pnpm lint` reads
  // `src` alone, while `format:check` takes `.css` as well — and `index.css` is where every token
  // and every text step lives. Neither reads `.html`.
  const present = sources.filter(path => existsSync(join(ROOT, path)))
  const formattable = present.filter(path => /\.(tsx?|css)$/.test(path))
  const lintable = formattable.filter(path => !path.endsWith('.css'))
  const results = await Promise.all([
    ...suites,
    run('typecheck', 'pnpm', ['typecheck']),
    ...(lintable.length > 0
      ? [
          run('lint', 'npx', [
            'eslint',
            '--max-warnings',
            '0',
            '--cache',
            '--cache-location',
            'node_modules/.cache/eslint/',
            ...lintable,
          ]),
        ]
      : []),
    ...(formattable.length > 0
      ? [run('format', 'npx', ['prettier', '--check', '--cache', ...formattable])]
      : []),
  ])

  return report(results)
}

// `exitCode` rather than `process.exit`: the failing gate's whole output has just been written,
// and on a pipe — `pnpm check | less`, or any capture — `exit` drops what is still buffered. The
// diagnostic that justifies this script would vanish exactly where nobody is watching a terminal.
process.exitCode = await main(process.argv[2] ?? 'HEAD')
