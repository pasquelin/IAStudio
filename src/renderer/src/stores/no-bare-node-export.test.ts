import { describe, expect, it } from 'vitest'

/**
 * Every store, as text. Read through Vite rather than through `fs`, like `no-hardcoded-text.test.ts`
 * and `tokens.test.ts` do: the renderer has no filesystem, and a test living here does not get one.
 *
 * Fixtures included on purpose — `graph-fixtures.ts` publishes one of the two names this rule is
 * about, and a rule that stopped at the shipped half is how the pair drifted in the first place.
 */
const STORES: Record<string, string> = import.meta.glob(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const EXPORTED = /^export (?:const|function|type|let) (\w+)/gm

const exportsOf = (source: string): string[] =>
  [...source.matchAll(EXPORTED)].map(match => match[1] ?? '')

const bareNodeExports = (sources: Record<string, string>): string[] =>
  Object.entries(sources).flatMap(([path, source]) =>
    exportsOf(source)
      .filter(name => name.startsWith('node'))
      .map(name => `${path}: ${name}`),
  )

/**
 * `node` is the word of TWO domains here, and each store publishes its own reader of one:
 * `nodeById` exists for a scene (`engines/scene/scene-state.ts`) and for a graph
 * (`shared/domain/graph.ts`). An export named `node…` therefore says nothing about which it
 * answers, and an editor's auto-import reaches whichever comes first — a suite then reads a graph
 * where it meant to read a scene, and asserts about the wrong document.
 *
 * Held by a test rather than left to review because it has already been half-broken: the scene
 * readers were prefixed while the graph ones stayed bare, and a fourth store
 * (`sequence-fixtures.ts`) is waiting with no reader of its own yet.
 */
describe('what a store exports about a node', () => {
  it('names the domain the node belongs to', () => {
    expect(bareNodeExports(STORES)).toEqual([])
  })

  /*
   * The rule proven on a name that breaks it, and it is not ceremony: asserting only that nothing
   * was found lets the predicate itself rot — narrow it to a word no file carries and the empty
   * list still comes back green. This is the case that makes the emptiness above mean something.
   */
  it('would say so of a store that broke it', () => {
    const offender = { './zz.ts': 'export const nodeIn = 1\nexport const graphNodeIn = 2\n' }

    expect(bareNodeExports(offender)).toEqual(['./zz.ts: nodeIn'])
  })

  /*
   * A guard that reads nothing passes by finding nothing, and would go on passing the day this
   * folder moves or the glob stops matching. The floor is what makes its silence mean something —
   * the same reason `import-cycles.test.ts` counts the files it opened.
   */
  it('read the stores to say so', () => {
    const names = Object.values(STORES).flatMap(exportsOf)

    expect(Object.keys(STORES).length).toBeGreaterThan(5)
    expect(names.length).toBeGreaterThan(20)
    // The two this lot renamed: if the glob ever stops reaching them, the rule above goes quiet.
    expect(names).toContain('graphNodeIn')
    expect(names).toContain('graphNodeNow')
  })
})
