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
 * (`shared/domain/graph.ts`). `history`: six stores published `historyOf`, while `audio-edits.ts`
 * had already written `audioHistoryOf` — the observed form the rest then followed. `view`: three
 * did, returning three different types, while `animation-view.ts:79` had already written
 * `animationViewOf`. **Each rule here was read off the repo before it was written down.**
 *
 * A word joins this list when a SECOND domain claims it, never in anticipation, and it joins WITH
 * its rename: added alone it reddens this guard, which is the intended behaviour. **That only
 * holds for a word a name OPENS on.** `isDirty` opens on `is` and `claimOnSubmit` on `claim`, so
 * listing either here would change nothing — measured. Those two are held by the collision rule
 * below instead, which is why both halves exist.
 *
 * **This list is for ambiguity ACROSS folders**, which a prefix is the right shape for. Two stores
 * publishing one name is a different question with a different shape — `claimImageOnSubmit` puts
 * its domain in the middle — and it is computed below rather than listed.
 */
const SHARED_WORDS: readonly string[] = ['node', 'history', 'view']

/**
 * The first camelCase word of a name — `viewportOf` opens on `viewport`, not on `view`.
 *
 * A prefix of LETTERS is what this compared at first, and it would have condemned `viewportOf`
 * (`stores/timeline-view.ts`) the day `view` joined the list. The reason it is spared is narrow
 * and worth writing exactly: **one store exports it** — NOT that `viewport` names one domain, for
 * two `Viewport` types exist (`engines/canvas/viewport.ts`, `engines/timeline/timeline-geometry.ts`).
 * The day a second store publishes a `viewportOf`, the collision rule below catches it; this list
 * would not. A rule that catches names it was never about is one its next reader disables.
 */
const opensOn = (name: string): string => name.split(/(?=[A-Z])/)[0] ?? name

// Regular plurals only — `nodesOf` is as ambiguous as `nodeOf`. An irregular one (`historiesOf`)
// escapes, and is left to the collision rule below rather than guessed at here.
const isShared = (name: string): boolean =>
  SHARED_WORDS.some(word => opensOn(name) === word || opensOn(name) === `${word}s`)

/**
 * The names more than one store publishes — computed, never listed.
 *
 * This is the other half of the rule, and the half a word list cannot state: `claimOnSubmit` was
 * shared by two stores and its corrected form, `claimImageOnSubmit`, carries the domain in the
 * MIDDLE — no prefix describes it. Asking which names have two owners needs no vocabulary at all,
 * catches a collision the day it appears, and would have found `historyOf` and `viewOf` on its own.
 */
const collidingExports = (sources: readonly (readonly [string, string])[]): string[] => {
  const owners = new Map<string, Set<string>>()
  for (const [path, source] of sources) {
    for (const name of exportsOf(source)) {
      const seen = owners.get(name) ?? new Set<string>()
      seen.add(path)
      owners.set(name, seen)
    }
  }

  return [...owners].filter(([, paths]) => paths.size > 1).map(([name]) => name)
}

/**
 * The collisions this guard has NOT closed yet, each a lot of its own at the chantier: `isDirty`,
 * published by `scenes.ts`, `settings-draft.ts` and `textures.ts` — and the third under a
 * different signature, so it is three renames rather than one.
 *
 * `claimOnSubmit` left this list on 2026-08-12, and the leaving is what the check below is for:
 * `image-generation.ts` now publishes `claimImageOnSubmit` — the name `generation-claims.ts` was
 * already importing it under — so the aggregate keeps the bare name, which is its by right. The
 * guard refused the stale entry before anyone thought to remove it.
 *
 * **This list only ever SHRINKS.** A name leaves it when its rename lands; a name that appears
 * here without a lot behind it is a collision being tolerated rather than fixed. A test below
 * refuses an entry that has stopped colliding, so it cannot rot into a permission.
 */
const KNOWN_COLLISIONS: readonly string[] = ['isDirty']

/** Exemptions whose collision is gone — debts written down after they were paid. */
const staleExemptions = (
  known: readonly string[],
  sources: readonly (readonly [string, string])[],
): string[] => known.filter(name => !collidingExports(sources).includes(name))

const bareExports = (sources: readonly (readonly [string, string])[]): string[] =>
  sources.flatMap(([path, source]) =>
    exportsOf(source)
      .filter(isShared)
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

  it('lets no two stores publish one name, beyond those already owed a lot', () => {
    const fresh = collidingExports(STORES).filter(name => !KNOWN_COLLISIONS.includes(name))

    expect(fresh).toEqual([])
  })

  /*
   * The exemption list held to its own evidence. Without this, a name renamed elsewhere would
   * stay written here forever and the next reader would take it for a decision rather than a
   * debt — and the list would grow instead of shrinking.
   */
  it('keeps no exemption that has stopped colliding', () => {
    expect(staleExemptions(KNOWN_COLLISIONS, STORES)).toEqual([])
  })

  /*
   * The anti-rot check proven on a list that HAS rotted — a test that reads its own exemptions
   * cannot vouch for itself, and the harness said so: emptying the check above left every other
   * assertion green.
   */
  it('would name an exemption whose collision is gone', () => {
    const one: [string, string][] = [['../stores/aa.ts', 'export const sizeOf = 1\n']]

    expect(staleExemptions(['sizeOf'], one)).toEqual(['sizeOf'])
  })

  it('would report a collision the day a second store published one name', () => {
    const pair: [string, string][] = [
      ['../stores/aa.ts', 'export const sizeOf = 1\n'],
      ['../stores/bb.ts', 'export const sizeOf = 2\n'],
    ]

    expect(collidingExports(pair)).toEqual(['sizeOf'])
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
        'export const nodeIn = 1\nexport const graphNodeIn = 2\nexport const historyOf = 3\n' +
          'export const nodesOf = 4\nexport const viewportOf = 5\nexport const viewOf = 6\n',
      ],
    ]

    // `viewportOf` is the one that must NOT be there: it opens on `viewport`, a word of one
    // domain, and a letter-prefix rule condemned it the day `view` joined the list.
    expect(bareExports(offender)).toEqual([
      '../stores/zz.ts: nodeIn',
      '../stores/zz.ts: historyOf',
      '../stores/zz.ts: nodesOf',
      '../stores/zz.ts: viewOf',
    ])
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
    for (const domain of ['canvas', 'scene', 'skybox']) {
      expect(names).toContain(`${domain}ViewOf`)
    }
  })
})
