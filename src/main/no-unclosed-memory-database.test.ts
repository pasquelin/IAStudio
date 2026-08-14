import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sitesIn } from './ast-sites'
import { SOURCE_ROOT, WHOLE_PROJECT } from './source-files'

const calls = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name

const opensADatabase = (node: ts.Node): boolean => calls(node, 'openMemoryDatabase')

/** Either spelling of the teardown: the method passed by reference, or called inside an arrow. */
const registersAClose = (node: ts.Node): boolean =>
  calls(node, 'onTestFinished') && /\bclose\b/.test(node.arguments[0]?.getText() ?? '')

function testFilesUnder(folder: string, into: string[] = []): string[] {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) testFilesUnder(path, into)
    else if (/\.test\.tsx?$/.test(path)) into.push(path)
  }

  return into
}

/** The opening sites a file has not matched with a teardown, named where a reader would look. */
export function unclosedIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  return sitesIn(file, path, opensADatabase).slice(sitesIn(file, path, registersAClose).length)
}

/**
 * `openMemoryDatabase` hands out a native handle, and a suite that drops it never gives it back.
 *
 * Measured on 2026-08-14: fourteen opening sites across the five catalogue suites, zero closings.
 * `node:sqlite` is experimental and its handles are finalised by the garbage collector at a time
 * nobody chooses, so a leak here is not a tidiness question — it leaves twelve worker processes
 * holding databases nothing will ask for again.
 *
 * THREE blind spots, written down rather than left to be found:
 *
 * - **counted, not paired.** Five teardowns of one handle would answer for five openings. Nothing
 *   in the tree does that today, and pairing would need the enclosing scope resolved, which buys
 *   a rule no reader could apply by eye.
 * - **one entry point.** `memoryCatalog` (`project/catalog-fixtures.ts`) opens a database without
 *   naming this helper, and its thirteen call sites are NOT read here. They are a lot of their
 *   own; this guard covers what calls the driver directly.
 * - **`onTestFinished` only.** A teardown written as `afterEach` over a list of handles reads as
 *   a leak. Deliberate: one spelling in the tree is one spelling to learn.
 */
describe('no test leaves a memory database open', () => {
  const findingsOf = (): string[] =>
    testFilesUnder(SOURCE_ROOT).flatMap(path =>
      unclosedIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
    )

  it(
    'closes every database it opens, in every suite of the project',
    () => {
      expect(findingsOf()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  // An empty result proves nothing unless the files were opened: pointed at a folder that does
  // not exist, the assertion above stays green.
  it('reads the suites the project ships', () => {
    expect(testFilesUnder(SOURCE_ROOT).length).toBeGreaterThan(100)
  })

  it('sees the opening the catalogue suites had left without a teardown', () => {
    expect(unclosedIn('probe.ts', 'const driver = openMemoryDatabase()')).toEqual(['probe.ts:1'])
  })

  it('takes the teardown passed by reference and the one wrapped in an arrow', () => {
    expect(
      unclosedIn('probe.ts', 'const d = openMemoryDatabase()\nonTestFinished(d.close)'),
    ).toEqual([])
    expect(
      unclosedIn('probe.ts', 'const d = openMemoryDatabase()\nonTestFinished(() => d.close())'),
    ).toEqual([])
  })

  it('names the surplus opening when a suite closes fewer than it opens', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'const a = openMemoryDatabase()\nonTestFinished(a.close)\nconst b = openMemoryDatabase()',
      ),
    ).toEqual(['probe.ts:3'])
  })

  // A teardown that finishes something else is not a database given back.
  it('reads neither a mention of the helper nor an unrelated teardown', () => {
    expect(unclosedIn('probe.ts', "const name = 'openMemoryDatabase'")).toEqual([])
    expect(
      unclosedIn(
        'probe.ts',
        'const d = openMemoryDatabase()\nonTestFinished(() => field.remove())',
      ),
    ).toEqual(['probe.ts:1'])
  })
})
