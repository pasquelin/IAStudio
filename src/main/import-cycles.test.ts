import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { resolveSpecifier } from './sourceFiles'

/**
 * The whole of `src`, walked from here.
 *
 * Under `main` rather than `shared`, though it judges all three trees: `shared` is compiled by the
 * web target too, which has no node types, so a file there cannot read the disk at all.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The import cycles this repository still carries, each written as its two files sorted.
 *
 * **Empty, and that is the point of keeping it.** A ratchet, not a target: the list is meant to
 * shrink and never to grow. Nothing else in `pnpm validate` sees a cycle — not the compiler, not
 * eslint, not the tests — so a cycle removed today can come back tomorrow with every gate green,
 * which is what happened to the fifth one. An empty list makes the next one fail on sight.
 *
 * **Nothing here enforces the direction.** A line can be added as easily as removed, and no test
 * can tell a surrender from a fix. Review is what holds it, and that is worth knowing rather than
 * pretending otherwise.
 *
 * It matched `madge --circular` exactly on the day it was written. That is an observation about
 * this tree, not a property of this detector: the two disagree the moment one sees an edge the
 * other does not.
 */
const KNOWN: readonly string[] = []

const sources = (from: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(from)) {
    const path = join(from, entry)
    if (statSync(path).isDirectory()) found.push(...sources(path))
    else if (/\.tsx?$/.test(entry)) found.push(path)
  }
  return found
}

/** Cycles as sorted, deduplicated pairs of repo-relative paths, so the order of a walk cannot show. */
const cyclesIn = (graph: Map<string, string[]>): string[] => {
  const found = new Set<string>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const done = new Set<string>()

  const walk = (node: string): void => {
    stack.push(node)
    onStack.add(node)
    for (const next of graph.get(node) ?? []) {
      if (onStack.has(next)) {
        const ring = stack.slice(stack.indexOf(next)).map(file => relative(SRC, file))
        found.add([...ring].sort().join(' -> '))
      } else if (!done.has(next)) walk(next)
    }
    stack.pop()
    onStack.delete(node)
    done.add(node)
  }

  for (const node of graph.keys()) if (!done.has(node)) walk(node)
  return [...found].sort()
}

/**
 * Test material — fixtures, harnesses, the fake bridge, and the suites themselves. Kept here
 * because this is where the question « who may import this » is asked.
 */
const TEST_MATERIAL = /(\.(test|bench)\.tsx?|-fixtures\.tsx?|testHarness\.ts|fakeBridge\.ts)$/

/** A fixture, recognised where the resolver LANDED rather than where a specifier pointed. */
const IS_FIXTURE = /-fixtures\.tsx?$/

/**
 * The fixtures one file reaches, resolved.
 *
 * Fixtures are out of both text guards — a decision, and its whole safety rests on nothing
 * shipped importing one. Such a file would put words on screen that no guard reads: two blind
 * spots meeting, neither of which would say a word.
 *
 * Resolved rather than matched on the specifier, so `?worker`, a `.js` spelt for a `.ts` and the
 * three aliases all land the same. The hole is the one written above `resolveSpecifier`: a worker
 * named through `new URL(…, import.meta.url)` is a URL, not an import, and stays invisible here.
 */
const fixturesReachedBy = (file: string, code: string): string[] =>
  ts
    .preProcessFile(code, true, true)
    .importedFiles.map(({ fileName }) => resolveSpecifier(fileName, file))
    .filter((target): target is string => target !== null && IS_FIXTURE.test(target))
    .map(target => `${relative(SRC, file)} -> ${relative(SRC, target)}`)

const shippedFiles = (): string[] => sources(SRC).filter(file => !TEST_MATERIAL.test(file))

function runtimeSpecifiers(file: string, code: string): string[] {
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const onlyNamedTypes =
        named &&
        ts.isNamedImports(named) &&
        !clause?.name &&
        named.elements.every(element => element.isTypeOnly)
      if (!clause?.isTypeOnly && !onlyNamedTypes) found.push(node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments
      if (argument && ts.isStringLiteral(argument)) found.push(argument.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}

describe('what a shipped file may reach', () => {
  it('reaches no fixture', () => {
    const found = shippedFiles().flatMap(file =>
      fixturesReachedBy(file, readFileSync(file, 'utf8')),
    )

    expect(found).toEqual([])
  })

  /**
   * An empty result proves nothing unless the files were opened. A floor rather than a tally: it
   * will not notice a handful going missing, but it does notice a walk that stopped walking —
   * which is how this check would pass while watching nothing.
   */
  it('opened the whole tree to say so', () => {
    expect(shippedFiles().length).toBeGreaterThan(600)
  })

  /** And it can fail. Four spellings that all land on one file, and two that land on none. */
  it('would see one reached for, however it was spelt', () => {
    const from = join(SRC, 'renderer', 'src', 'panels', 'jobs', 'probe.ts')
    const reached = 'renderer/src/panels/jobs/probe.ts -> renderer/src/stores/job-fixtures.ts'

    expect(fixturesReachedBy(from, "import { job } from '@/stores/job-fixtures'")).toEqual([
      reached,
    ])
    expect(fixturesReachedBy(from, "export { job } from '@/stores/job-fixtures'")).toEqual([
      reached,
    ])
    expect(fixturesReachedBy(from, "await import('@/stores/job-fixtures')")).toEqual([reached])
    // Vite's own suffix, which names the same module — `resolveSpecifier` is what makes it land.
    expect(fixturesReachedBy(from, "import W from '@/stores/job-fixtures?worker'")).toEqual([
      reached,
    ])

    expect(fixturesReachedBy(from, "import { j } from '@/stores/jobs'")).toEqual([])
    expect(fixturesReachedBy(from, "import { load } from './fixture'")).toEqual([])
  })
})

describe('the import graph', () => {
  it('carries no import cycle at all', () => {
    const files = sources(SRC)
    const graph = new Map<string, string[]>(
      files.map(file => {
        const imports = runtimeSpecifiers(file, readFileSync(file, 'utf8'))
        const edges = imports
          .map(fileName => resolveSpecifier(fileName, file))
          .filter((target): target is string => target !== null)
        return [file, edges]
      }),
    )

    const found = cyclesIn(graph)
    const known = [...KNOWN].sort()

    // An empty result proves nothing unless the files were opened — the same floor the fixture
    // walk keeps, and for the same reason: a walk that stopped walking prints this green too.
    expect(files.length).toBeGreaterThan(600)

    // Two assertions rather than one equality: a cycle that appeared is a regression to undo, a
    // cycle that vanished is a line to delete here. A single diff would report them alike.
    expect(found.filter(cycle => !known.includes(cycle))).toEqual([])
    expect(known.filter(cycle => !found.includes(cycle))).toEqual([])
  })

  /**
   * And it can fail. While `KNOWN` held entries, the second assertion above was the liveness
   * probe: a detector gone blind answered nothing and the missing lines reddened. Emptying the
   * list retired that probe — `[].filter(…)` is empty however broken the walk is — so the proof
   * that this file can still SEE a cycle has to be made on a graph of its own.
   */
  it('would see a cycle if the tree had one', () => {
    const [a, b] = [join(SRC, 'a.ts'), join(SRC, 'b.ts')]
    const ring = new Map([
      [a, [b]],
      [b, [a]],
    ])

    expect(cyclesIn(ring)).toEqual(['a.ts -> b.ts'])
  })
})
