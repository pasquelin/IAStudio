import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from '@/design/test-harness'

/**
 * The stores, as text. Taken from the renderer-wide sweep the other written-form guards read
 * (`design/tokens.test.ts`, `text-scale.test.ts`, `spacing.test.ts`) rather than from a second
 * glob of this file's own: two sweeps of the same tree drift, and the day they disagree the rule
 * that reads the smaller one goes quiet without failing.
 */
const STORES = WRITTEN_SOURCES.filter(([path]) => path.startsWith('../stores/'))

/**
 * Every form this repo actually exports under: `const`, `function`, `async function`, `type`,
 * `let`, `class` — and the `export { a, b as c }` list, which five renderer modules use. The
 * first three were the only ones read at first, and the missing ones were a hole rather than a
 * leak: measured, no store exports under them today, so the rule was true and would have gone on
 * being true right up to the first `export async function nodeThumbnail`.
 */
const DECLARED = /^export (?:async )?(?:const|function|type|let|class) (\w+)/gm
const LISTED = /^export \{([^}]*)\}/gm

const exportsOf = (source: string): string[] => [
  ...[...source.matchAll(DECLARED)].map(match => match[1] ?? ''),
  ...[...source.matchAll(LISTED)]
    .flatMap(match =>
      (match[1] ?? '').split(',').map(part => (part.split(' as ').pop() ?? '').trim()),
    )
    .filter(name => name.length > 0),
]

const bareNodeExports = (sources: readonly (readonly [string, string])[]): string[] =>
  sources.flatMap(([path, source]) =>
    exportsOf(source)
      .filter(name => name.startsWith('node'))
      .map(name => `${path}: ${name}`),
  )

/**
 * `node` is the word of TWO domains, and each has its own reader: `nodeById` for a scene
 * (`engines/scene/scene-state.ts`) and for a graph (`shared/domain/graph.ts`). A store export
 * named `node…` therefore says nothing about which it answers, and an editor's auto-import
 * reaches whichever comes first — a suite then reads a graph where it meant a scene, and asserts
 * about the wrong document.
 *
 * **What this holds, exactly, and it is less than its subject.** One word, `node`, and one folder,
 * `stores/`. It does NOT hold the two `nodeById` above — they are upstream, in `engines/` and
 * `shared/`, across 53 sites and a coverage budget at zero margin — nor the other words two
 * domains share here (`clip` is a video clip and a GLB animation clip; `track` is exported by
 * `engines/timeline/timeline-state.ts` and lives again on `AnimationTrack`), nor `historyOf`,
 * which six stores publish under one name. Each of those is written at the chantier as its own
 * lot. **A green run here means this one word is clean in this one folder — nothing wider**, and
 * saying so is the point: a guard that let its silence be read as coverage would be worse than
 * none.
 */
describe('what a store exports about a node', () => {
  it('names the domain the node belongs to', () => {
    expect(bareNodeExports(STORES)).toEqual([])
  })

  /*
   * The rule proven on a name that breaks it, and it is not ceremony: asserting only that nothing
   * was found lets the predicate itself rot — narrow it to a word no file carries and the empty
   * list still comes back green. Measured: without this case, narrowing `node` to `nodeZZ`
   * survived the whole suite.
   */
  it('would say so of a store that broke it', () => {
    const offender: [string, string][] = [
      ['../stores/zz.ts', 'export const nodeIn = 1\nexport const graphNodeIn = 2\n'],
    ]

    expect(bareNodeExports(offender)).toEqual(['../stores/zz.ts: nodeIn'])
  })

  /*
   * A guard that reads nothing passes by finding nothing, and would go on passing the day the
   * folder moves or the filter stops matching — the same reason `import-cycles.test.ts` counts
   * the files it opened.
   */
  it('read the stores to say so', () => {
    const names = STORES.flatMap(([, source]) => exportsOf(source))

    // Measured 57 files and 184 exports on 2026-08-12. A floor ten times under the count passes
    // a folder that has quietly stopped being read, which is the one thing it exists to catch.
    expect(STORES.length).toBeGreaterThan(40)
    expect(names.length).toBeGreaterThan(150)
    // The two this rule renamed: if the filter ever stops reaching them, the check above goes quiet.
    expect(names).toContain('graphNodeIn')
    expect(names).toContain('graphNodeNow')
  })
})
