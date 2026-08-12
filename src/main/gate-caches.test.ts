import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '../../package.json'

/**
 * What keeps the gate from redoing, on every call, work it has already done.
 *
 * Measured on 12 August, twelve logical cores: reading all of `src/` costs eslint 13.5 s and
 * prettier 10.1 s, and both did it on every run. With the cache and one file actually changed —
 * what a batch does between two runs — they cost 1.0 s and 1.6 s. The typecheck goes from 8.82 s
 * to 3.21 s, five alternating pairs, ±1 %.
 *
 * None of this changes a verdict; it changes what gets recomputed. So nothing else in the suite
 * would go red the day a flag is dropped, which is why these cases exist.
 *
 * Under `src/main` for the reason `coverage-budgets.ts` gives: these files sit at the repository
 * root, and `src/shared` compiles for the renderer.
 */
const ROOT = join(import.meta.dirname, '..', '..')
const read = (name: string) => readFileSync(join(ROOT, name), 'utf8')

/**
 * The flag itself, not a prefix of a longer one. `--cache-location` alone turns nothing on: it
 * names a file eslint never writes. A review dropped `--cache` and kept the location — the cache
 * went to zero entries and every case here stayed green.
 */
const caches = (script: string) => /--cache(\s|$)/.test(script)

describe('the gate not rereading what it has already judged', () => {
  it('lets eslint skip the files it has already judged', () => {
    expect(caches(manifest.scripts.lint)).toBe(true)
  })

  it('lets prettier skip the files it has already read, checking and writing alike', () => {
    expect(caches(manifest.scripts['format:check'])).toBe(true)
    expect(caches(manifest.scripts.format)).toBe(true)
  })

  /**
   * A cache written beside the source is a cache somebody commits. `node_modules/` is ignored
   * whole, and a fresh clone starts cold — which is what CI does on every run, so the cache can
   * never be what makes it green.
   */
  it('keeps every cache out of the tree git tracks', () => {
    expect(manifest.scripts.lint).toContain('--cache-location node_modules/')
    for (const config of ['tsconfig.node.json', 'tsconfig.web.json']) {
      expect(read(config)).toContain('"tsBuildInfoFile": "node_modules/')
    }
  })

  it('lets tsc reuse its previous pass', () => {
    expect(read('tsconfig.base.json')).toContain('"incremental": true')
  })

  /**
   * The two passes are two programs. Pointed at one state file they overwrite each other every
   * time — measured: 9.43 s, then 9.74 s and 9.54 s "warm", against 3.21 s with one file each.
   * A gain that vanishes while every flag still reads as set is what this case exists to catch.
   */
  it('gives each of the two typecheck passes its own state file', () => {
    const node = read('tsconfig.node.json').match(/"tsBuildInfoFile": "([^"]+)"/)?.[1]
    const web = read('tsconfig.web.json').match(/"tsBuildInfoFile": "([^"]+)"/)?.[1]

    expect(node).toBeDefined()
    expect(web).not.toBe(node)
  })
})

/**
 * Type information costs a whole TypeScript program at parse time — the one `pnpm typecheck`
 * builds a moment earlier. Measured over eight paired runs: removing it takes the median lint
 * from 26.1 s to 9.6 s, and every one of the eight rules this repository enforces fires
 * identically without it. That includes `consistent-type-imports`, the only plausible candidate,
 * which typescript-eslint documents as using scope analysis rather than types.
 *
 * So the two belong together or not at all. A typed preset without the service errors out loudly;
 * the service without a typed rule is a cost nothing announces, and this is the half that would
 * pass unnoticed.
 */
describe('the eslint parser being given a program only when a rule needs one', () => {
  /**
   * Comments dropped first, and this took four tries — each version green while the setting it
   * guards was back in place. The trap is the one `coverage-thresholds.test.ts` names on the
   * config it reads: this file explains the very rule it enforces, so its own prose names both
   * words.
   *
   * 1. Line comments only: a `/* … *\/` on one line slipped through.
   * 2. A regex over the whole text: `'**\/*.{ts,tsx}'` contains `/*`, so the block pattern ate the
   *    config from the first glob to the next `*\/` — `projectService` with it. That version
   *    reported the setting absent while it sat three lines below.
   * 3. Dropping lines that OPEN with `/*` or `*`: prose inside a block, on a line carrying no
   *    leading asterisk, survived.
   *
   * Hence a state, not a pattern: once a line opens a block, every line belongs to it until one
   * closes it. What this still does NOT hold is a comment sharing its line with code — naming the
   * preset at the end of a config line would slip through, and no case here catches it.
   */
  it('asks for type information exactly when a rule requires it', () => {
    let inBlock = false
    const config = read('eslint.config.mjs')
      .split('\n')
      .filter(line => {
        const text = line.trim()
        if (inBlock) {
          inBlock = !text.includes('*/')
          return false
        }
        if (text.startsWith('//')) return false
        if (!text.startsWith('/*')) return true

        inBlock = !text.includes('*/')
        return false
      })
      .join('\n')

    expect(config.includes('projectService')).toBe(config.includes('TypeChecked'))
  })
})
