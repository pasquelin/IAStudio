import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'

/**
 * One name, one module — within `src/main`.
 *
 * The window holds its own half of this (`stores/no-bare-shared-word-export.test.ts`, first
 * camelCase word, `stores/` only). Nothing held the main process, where the defect is worse:
 * `parseModelId` named the catalogue's ids and the local engine's, both `(unknown) => string`.
 * Identical signature is what makes it silent — a wrong auto-import type-checks and lints, and
 * the two schemas did not even agree on `.trim()`.
 *
 * Scoped to `main` because it is tenable at zero there and nowhere else: read the same way, the
 * four trees publish 32 names twice, several of them legitimately — `snap(value, step)` and
 * `snap(time, candidates)` are two answers, not one written twice.
 *
 * **What it does not see, in clear.** The first draft read `function|const|class` only, and an
 * adversarial review found two type collisions living behind that gap — `Admission` between
 * `ai/` and `provider/`, the very pair this guard was written for. Declarative forms are read
 * now; these are NOT, and each would need a parser rather than a line: `export { x }` and
 * `export * from`, which re-publish a name declared elsewhere; `export default`, which carries
 * no name here; and a declaration whose `export` keyword sits on its own line.
 */
const [MAIN] = PROJECT_TREES

const DECLARES =
  /(?:^|\n)export (?:async |declare |abstract )*(?:function\*?|const|let|var|class|type|interface|enum) (\w+)/g

const exportsIn = (code: string): Set<string> =>
  // `?? ''`: the group is filled whenever the pattern matched, which the type cannot know.
  new Set([...code.matchAll(DECLARES)].map(match => match[1] ?? ''))

describe('one name, one module', () => {
  it(
    'lets no two modules of the main process export one name',
    () => {
      const byName = new Map<string, string[]>()
      for (const path of sourceFiles(MAIN ?? ''))
        for (const name of exportsIn(readFileSync(path, 'utf8')))
          byName.set(name, [...(byName.get(name) ?? []), relative(SOURCE_ROOT, path)])

      const shared = [...byName]
        .filter(([, paths]) => paths.length > 1)
        .map(([name, paths]) => `${name}: ${paths.sort().join(', ')}`)

      expect(shared.sort()).toEqual([])
    },
    WHOLE_PROJECT,
  )
})
