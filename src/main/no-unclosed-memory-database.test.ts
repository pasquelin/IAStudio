import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { siteOf, walkIn } from './ast-sites'
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

/**
 * The names a teardown gives back — `driver.close` passed along, `() => driver.close()` alike.
 *
 * Read off the tree rather than off the text. A review caught the text reading absolving a leak
 * through a COMMENT that mentioned `driver.close()`, and through a string that spelt it: prose
 * about a handle is not a handle given back.
 */
function closedNamesOf(argument: ts.Expression | undefined): string[] {
  const names: string[] = []
  if (argument)
    walkIn(argument, node => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === 'close' &&
        ts.isIdentifier(node.expression)
      )
        names.push(node.expression.text)
    })

  return names
}

const tally = (names: readonly string[]): Map<string, number> =>
  names.reduce((counts, name) => counts.set(name, (counts.get(name) ?? 0) + 1), new Map())

/** The openings this file never gives back, named where a reader would open the suite. */
export function unclosedIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const openings: { name: string | undefined; site: string }[] = []
  const givenBack: string[] = []

  walkIn(file, node => {
    if (calls(node, 'openMemoryDatabase'))
      openings.push({ name: nameBoundTo(node), site: siteOf(file, path, node) })
    else if (calls(node, 'onTestFinished')) givenBack.push(...closedNamesOf(node.arguments[0]))
  })

  const opened = tally(openings.flatMap(opening => (opening.name ? [opening.name] : [])))
  const closed = tally(givenBack)

  // A name short of teardowns names ALL its openings: which of them leaks cannot be told from a
  // name alone, and pointing at one of them pointed at the sound one half the time.
  return openings
    .filter(({ name }) => name === undefined || (opened.get(name) ?? 0) > (closed.get(name) ?? 0))
    .map(({ site }) => site)
}

/**
 * `openMemoryDatabase` hands out a native handle, and a suite that drops it never gives it back.
 *
 * Measured on 2026-08-14: fourteen openings across the five catalogue suites, zero teardowns.
 * `node:sqlite` is experimental and its handles are finalised by the garbage collector at a time
 * nobody chooses, so a leak here is not a tidiness question — it leaves twelve worker processes
 * holding databases nothing will ask for again.
 *
 * **Matched by NAME, and read off the TREE.** Two earlier drafts were shown green on a real leak:
 * one counted teardowns without reading whose they were, so closing a server answered for a
 * database; the next read the argument as text, so a comment explaining why the handle was left
 * open absolved it. The handle's own name has to come back, spelt as code.
 *
 * FOUR blind spots, written down rather than left to be found:
 *
 * - **one entry point, and it is the SUITES that are read.** `memoryCatalog`
 *   (`project/catalog-fixtures.ts`) opens through this helper, but a fixture is not a `.test.ts`
 *   and is never swept; its thirteen callers name only `memoryCatalog`. Traced one by one on
 *   2026-08-14: `local-backend.test.ts` closes its two, and the three of `store.test.ts` come back
 *   through `store.ts:234`, so **eight** still leak. A lot of its own.
 * - **a name, not a binding.** Two handles sharing a name share their tally. The case that gets
 *   through is a teardown posted in one `describe` for a handle opened elsewhere under the same
 *   name — `catalog` closed for a `memoryCatalog()` answers for a `createCatalog(open…())` next
 *   door. Resolving scopes buys a rule no reader could apply by eye.
 * - **three correct spellings it refuses**, all erring towards the safe side and none in the tree:
 *   `const { close } = openMemoryDatabase()`, a handle renamed before its teardown, and a handle
 *   handed to a helper that closes it. Each reads as a leak.
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

  // What the text-reading draft got wrong: prose about a handle is not a handle given back.
  it('refuses a comment and a string that only mention the teardown', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'const d = openMemoryDatabase()\nonTestFinished(() => {\n  // d.close() is the store’s job\n  store.stop()\n})',
      ),
    ).toEqual(['probe.ts:1'])
    expect(
      unclosedIn(
        'probe.ts',
        "const d = openMemoryDatabase()\nonTestFinished(() => log('d.close skipped'))",
      ),
    ).toEqual(['probe.ts:1'])
  })

  it('takes the handle reassigned before each test, once per opening', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'beforeEach(() => {\n  driver = openMemoryDatabase()\n  onTestFinished(driver.close)\n})',
      ),
    ).toEqual([])
  })

  // Which of a short name's openings leaks cannot be told from the name, so it names them all —
  // an earlier draft credited them in order and pointed at the one that was sound.
  it('names every opening of a name that gives back fewer than it takes', () => {
    expect(
      unclosedIn(
        'probe.ts',
        'const d = openMemoryDatabase()\nconst d2 = openMemoryDatabase()\nonTestFinished(d2.close)',
      ),
    ).toEqual(['probe.ts:1'])
    expect(
      unclosedIn(
        'probe.ts',
        'driver = openMemoryDatabase()\ndriver = openMemoryDatabase()\nonTestFinished(driver.close)',
      ),
    ).toEqual(['probe.ts:1', 'probe.ts:2'])
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
