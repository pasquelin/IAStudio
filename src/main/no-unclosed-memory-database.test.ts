import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sitesIn } from './ast-sites'
import { SOURCE_ROOT, WHOLE_PROJECT } from './source-files'
import { testFilesUnder } from './wide-guards'

const calls = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name

/**
 * The name the opening was bound to, whether declared or assigned.
 *
 * `undefined` for an opening nobody named — `serve(createCatalog(openMemoryDatabase()), port)` —
 * which no teardown can ever reach and so is always a finding. The climb stops at a function
 * boundary: `const open = () => openMemoryDatabase()` binds a factory, not a handle.
 */
function nameBoundTo(node: ts.Node): string | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isVariableDeclaration(current))
      return ts.isIdentifier(current.name) ? current.name.text : undefined
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      return ts.isIdentifier(current.left) ? current.left.text : undefined
    if (ts.isFunctionLike(current)) return undefined
  }

  return undefined
}

/** Both spellings of the teardown: `driver.close` passed along, and `() => driver.close()`. */
const closedNamesOf = (argument: ts.Expression | undefined): string[] =>
  [...(argument?.getText() ?? '').matchAll(/\b([A-Za-z_$][\w$]*)\.close\b/g)].map(match =>
    String(match[1]),
  )

/** `sitesIn` walked for its recursion alone — the rule below records rather than recognises. */
function namesGivenBack(file: ts.SourceFile): Map<string, number> {
  const names = new Map<string, number>()

  sitesIn(file, '', node => {
    if (calls(node, 'onTestFinished'))
      for (const name of closedNamesOf(node.arguments[0]))
        names.set(name, (names.get(name) ?? 0) + 1)

    return false
  })

  return names
}

/** The openings this file never gives back, named where a reader would open the suite. */
export function unclosedIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const given = namesGivenBack(file)

  return sitesIn(file, path, node => {
    if (!calls(node, 'openMemoryDatabase')) return false

    const name = nameBoundTo(node)
    const left = name === undefined ? 0 : (given.get(name) ?? 0)
    if (left === 0) return true

    given.set(String(name), left - 1)
    return false
  })
}

/**
 * `openMemoryDatabase` hands out a native handle, and a suite that drops it never gives it back.
 *
 * Measured on 2026-08-14: fourteen openings across the five catalogue suites, zero teardowns.
 * `node:sqlite` is experimental and its handles are finalised by the garbage collector at a time
 * nobody chooses, so a leak here is not a tidiness question — it leaves twelve worker processes
 * holding databases nothing will ask for again.
 *
 * **Matched by NAME, not counted.** An earlier draft counted `onTestFinished` calls whose argument
 * mentioned `close`, and a review showed it green on a suite that leaked a database while closing
 * a server: any teardown answered for any opening. The handle's own name has to come back.
 *
 * THREE blind spots, written down rather than left to be found:
 *
 * - **one entry point, and it is the SUITES that are read.** `memoryCatalog`
 *   (`project/catalog-fixtures.ts`) opens through this helper, but a fixture is not a `.test.ts`
 *   and is never swept; its thirteen callers name only `memoryCatalog`, so nothing here sees them.
 *   Eleven of the thirteen still leak — a lot of its own, and the reason this guard's title claims
 *   the openings it can read rather than every database the project opens.
 * - **a name, not a binding.** Two handles called `driver` in two `it()` blocks are one name with
 *   two openings and two teardowns. Resolving the scope would buy a rule no reader could apply by
 *   eye, and nothing in the tree closes one handle twice.
 * - **`onTestFinished` only.** A teardown written as `afterEach` over a list of handles reads as a
 *   leak. Deliberate: one spelling in the tree is one spelling to learn. Measured the same day:
 *   the five catalogue suites hold no `afterEach` at all.
 */
describe('every database a suite opens by name is given back', () => {
  const findingsOf = (): string[] =>
    testFilesUnder(SOURCE_ROOT).flatMap(path =>
      unclosedIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
    )

  it(
    'gives back every database it opened, in every suite of the project',
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

  // What the counting draft got wrong, and the reason this guard reads names.
  it('refuses a teardown that gives back something else', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'const d = openMemoryDatabase()\nonTestFinished(() => server.close())',
      ),
    ).toEqual(['probe.ts:1'])
    expect(
      unclosedIn('probe.ts', "const d = openMemoryDatabase()\nonTestFinished(() => log('close'))"),
    ).toEqual(['probe.ts:1'])
  })

  it('takes the handle reassigned before each test, once per opening', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'beforeEach(() => {\n  driver = openMemoryDatabase()\n  onTestFinished(driver.close)\n})',
      ),
    ).toEqual([])
    expect(
      unclosedIn(
        'probe.ts',
        'driver = openMemoryDatabase()\nonTestFinished(driver.close)\ndriver = openMemoryDatabase()',
      ),
    ).toEqual(['probe.ts:3'])
  })

  // An opening nobody named is an opening no teardown can reach.
  it('refuses an opening handed straight to a caller', () => {
    expect(
      unclosedIn('probe.ts', 'serveCatalog(createCatalog(openMemoryDatabase()), port)'),
    ).toEqual(['probe.ts:1'])
  })

  it('reads neither a mention of the helper nor a teardown of its own', () => {
    expect(unclosedIn('probe.ts', "const name = 'openMemoryDatabase'")).toEqual([])
    expect(unclosedIn('probe.ts', 'onTestFinished(d.close)')).toEqual([])
  })
})
