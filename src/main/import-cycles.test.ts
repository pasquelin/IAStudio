import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The whole of `src`, walked from here.
 *
 * Under `main` rather than `shared`, though it judges all three trees: `shared` is compiled by the
 * web target too, which has no node types, so a file there cannot read the disk at all.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The four import cycles this repository still carries, each written as its two files sorted.
 *
 * A ratchet, not a target: this list is meant to shrink and never to grow. Nothing else in
 * `pnpm validate` sees a cycle — not the compiler, not eslint, not the tests — so a cycle removed
 * today can come back tomorrow with every gate green, which is what happened to the fifth one.
 *
 * **Nothing here enforces the direction.** A line can be added as easily as removed, and no test
 * can tell a surrender from a fix. Review is what holds it, and that is worth knowing rather than
 * pretending otherwise.
 *
 * It matched `madge --circular` exactly on the day it was written. That is an observation about
 * this tree, not a property of this detector: the two disagree the moment one sees an edge the
 * other does not.
 */
const KNOWN: readonly string[] = [
  'main/scenario/job-store.ts -> main/scenario/validation.ts',
  'renderer/src/engines/canvas/CanvasEngine.ts -> renderer/src/engines/canvas/brush.ts',
  'renderer/src/engines/canvas/canvas-state.ts -> renderer/src/engines/canvas/shape-geometry.ts',
  'renderer/src/stores/layout-prune.ts -> renderer/src/stores/layouts.ts',
]

const ALIASES: readonly [string, string][] = [
  ['@/', 'renderer/src/'],
  ['@shared/', 'shared/'],
  ['@main/', 'main/'],
]

const sources = (from: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(from)) {
    const path = join(from, entry)
    if (statSync(path).isDirectory()) found.push(...sources(path))
    else if (/\.tsx?$/.test(entry)) found.push(path)
  }
  return found
}

/**
 * Where a specifier lands, or `null` when nothing under `src` answers it — a package, a node
 * builtin, an asset, or a path this resolver cannot follow.
 *
 * Type-only imports count like any other: the fifth cycle was made of one.
 *
 * `.js` spelt for a `.ts` file resolves too. `moduleResolution: 'bundler'` accepts both, the repo
 * writes both, and a cycle spelt that way compiled, linted and BUILT while this ratchet said four
 * — measured, before the substitution below existed.
 *
 * What it still cannot see, and neither can madge: a worker named through `new URL('./x.js',
 * import.meta.url)` — four of them, at `project/catalog-thread.ts`, `scenario/transform-thread.ts`,
 * `media/peaks-process.ts`, `dictation/stt-process.ts`. That is a URL, not an import, and each of
 * those workers is a build entry point of its own.
 */
const resolveImport = (specifier: string, fromFile: string): string | null => {
  // `?worker` and `?raw` are Vite's, and the module they name is still a module.
  const bare = specifier.split('?')[0] ?? specifier
  const alias = ALIASES.find(([prefix]) => bare.startsWith(prefix))
  const target = alias
    ? join(SRC, alias[1], bare.slice(alias[0].length))
    : bare.startsWith('.')
      ? resolve(dirname(fromFile), bare)
      : null
  if (!target) return null

  const stem = target.replace(/\.[cm]?jsx?$/, '')
  for (const candidate of [
    target,
    `${stem}.ts`,
    `${stem}.tsx`,
    join(stem, 'index.ts'),
    join(stem, 'index.tsx'),
  ]) {
    if (/\.tsx?$/.test(candidate) && existsAsFile(candidate)) return candidate
  }
  return null
}

const existsAsFile = (path: string): boolean => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
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

describe('the import graph', () => {
  it('carries no cycle beyond the four already there', () => {
    const files = sources(SRC)
    const graph = new Map<string, string[]>(
      files.map(file => {
        const imports = ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles
        const edges = imports
          .map(({ fileName }) => resolveImport(fileName, file))
          .filter((target): target is string => target !== null)
        return [file, edges]
      }),
    )

    const found = cyclesIn(graph)
    const known = [...KNOWN].sort()

    // Two assertions rather than one equality: a cycle that appeared is a regression to undo, a
    // cycle that vanished is a line to delete here. A single diff would report them alike.
    expect(found.filter(cycle => !known.includes(cycle))).toEqual([])
    expect(known.filter(cycle => !found.includes(cycle))).toEqual([])
  })
})
