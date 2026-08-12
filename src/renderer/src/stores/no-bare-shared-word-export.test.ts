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

/**
 * The words two of this studio's domains both own. Each is a reader that answers for ONE kind of
 * document while its name says which of several it could be — so each needs the domain in front.
 *
 * `node`: `nodeById` exists for a scene (`engines/scene/scene-state.ts`) and for a graph
 * (`shared/domain/graph.ts`). `history`: six stores published `historyOf` under that one name —
 * graphs, canvases, scenes, sequences, skyboxes, textures — while `audio-edits.ts` had already
 * written `audioHistoryOf`, which is the form the rest now follows.
 *
 * A word joins this list when a SECOND domain claims it, never in anticipation: a rule wider than
 * its evidence is one the next reader argues with instead of obeying.
 *
 * **Three words already meet that bar and are NOT here yet**, each because adding it without its
 * rename would redden this guard — which is the intended behaviour, not an accident: `viewOf`
 * (`canvas-views.ts`, `scene-views.ts`, `skybox-views.ts` — three stores, three return types),
 * `isDirty` (`scenes.ts`, `textures.ts`, beside their own prefixed `sceneOf`/`sceneHistoryOf`),
 * and `claimOnSubmit` (`image-generation.ts`, whose collision is already worked around by
 * `generation-claims.ts:2` importing it under an alias). Each is a lot of its own at the chantier.
 */
const SHARED_WORDS: readonly string[] = ['node', 'history']

const bareExports = (sources: readonly (readonly [string, string])[]): string[] =>
  sources.flatMap(([path, source]) =>
    exportsOf(source)
      .filter(name => SHARED_WORDS.some(word => name.startsWith(word)))
      .map(name => `${path}: ${name}`),
  )

/**
 * A store export whose name starts with a word two domains share says nothing about which of them
 * it answers, and an editor's auto-import reaches whichever comes first — a suite then reads a
 * graph where it meant a scene, and asserts about the wrong document.
 *
 * **What this holds, exactly, and it is less than its subject.** The words of `SHARED_WORDS`, in
 * one folder: `stores/`. It does NOT hold the two `nodeById` upstream — they are in `engines/`
 * and `shared/`, across 53 sites and a coverage budget at zero margin — nor `clip` and `track`,
 * which two domains share and whose files are held by another branch today. Each is written at
 * the chantier as its own lot. **A green run here means these words are clean in this one
 * folder — nothing wider**, and saying so is the point: a guard whose silence could be read as
 * coverage would be worse than none.
 *
 * `document-store.ts` is deliberately untouched by all this: its `historyOf` is a member of the
 * generic factory's contract, not a module export, so no import can reach it ambiguously.
 */
describe('what a store exports about a shared word', () => {
  it('names the domain the export belongs to', () => {
    expect(bareExports(STORES)).toEqual([])
  })

  /*
   * The rule proven on a name that breaks it, and it is not ceremony: asserting only that nothing
   * was found lets the predicate itself rot — narrow it to a word no file carries and the empty
   * list still comes back green. Measured: without this case, narrowing `node` to `nodeZZ`
   * survived the whole suite.
   */
  it('would say so of a store that broke it', () => {
    const offender: [string, string][] = [
      [
        '../stores/zz.ts',
        'export const nodeIn = 1\nexport const graphNodeIn = 2\nexport const historyOf = 3\n',
      ],
    ]

    expect(bareExports(offender)).toEqual(['../stores/zz.ts: nodeIn', '../stores/zz.ts: historyOf'])
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
    // All six, not one of them: the filter is a path prefix, so a single store moved out of the
    // folder would go unwatched while a sentinel pinned to another store stayed green.
    for (const domain of ['graph', 'canvas', 'scene', 'sequence', 'skybox', 'texture']) {
      expect(names).toContain(`${domain}HistoryOf`)
    }
  })
})
