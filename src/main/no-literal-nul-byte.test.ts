import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

const NUL = 0
const NEWLINE = 0x0a

/**
 * Where a source carries the byte itself rather than an escape for it, as `path:line`.
 *
 * Bytes and not text: decoded as UTF-8 the byte becomes one character of the string, which no
 * longer tells it apart from the six characters that spell the escape.
 */
function nulSitesIn(path: string, bytes: Buffer): string[] {
  if (!bytes.includes(NUL)) return []

  const sites: string[] = []
  let line = 1
  for (const byte of bytes) {
    if (byte === NEWLINE) line += 1
    else if (byte === NUL) sites.push(`${path}:${line}`)
  }

  return sites
}

/**
 * A literal NUL makes git call the file BINARY, and a binary file is one nobody reviews.
 *
 * The byte is legitimate as a VALUE; what costs is spelling it raw instead of escaped, which
 * compiles to the very same string. Refused wherever it sits and not only in the first 8 000 bytes
 * git actually reads: the second file that carried one sat past that window, and would have
 * flipped the day a line was added above it.
 *
 * **TWO blind spots, written rather than discovered.** The sweep stops at the four trees of
 * `src/`, so the TypeScript tracked at the root and under `scripts/` is out — an octet landing
 * there produces the identical symptom. And it reads TypeScript only, so the JSON, CSS and HTML
 * of `src/` are out as well. What blocks a sweep of EVERY tracked file is narrower than it looks:
 * five files, the `.ttf` and `.wasm` that carry the byte legitimately. Closing either half means
 * an exemption list, and that is a lot of its own.
 */
describe('no source spells the NUL byte as the byte itself', () => {
  const sourcesOf = (): string[] => PROJECT_TREES.flatMap(tree => testFilesUnder(tree, /\.tsx?$/))

  it(
    'holds every TypeScript source of the four trees, suites and fixtures included',
    () => {
      expect(
        sourcesOf().flatMap(path => nulSitesIn(relative(SOURCE_ROOT, path), readFileSync(path))),
      ).toEqual([])
    },
    WHOLE_PROJECT,
  )

  // An empty result proves nothing unless the files were opened: pointed at a folder that does not
  // exist, the assertion above stays green. The sweep is counted, and it must see the suites the
  // production sweep drops — that is the whole reason this one is written from `testFilesUnder`.
  it('sweeps the four trees, suites included', () => {
    const swept = sourcesOf()

    expect(
      PROJECT_TREES.map(tree => testFilesUnder(tree, /\.tsx?$/).length).every(n => n > 0),
    ).toBe(true)
    expect(swept.length).toBeGreaterThan(1_000)
    expect(swept.some(path => path.endsWith('.test.ts'))).toBe(true)
  })

  it('names the line the byte sits on, and every line that carries one', () => {
    const nul = String.fromCodePoint(NUL)
    const source = `const a = 1\nconst b = '${nul}'\nconst c = '${nul}'`

    expect(nulSitesIn('probe.ts', Buffer.from(source))).toEqual(['probe.ts:2', 'probe.ts:3'])
  })

  it('leaves the escape that spells the same string alone', () => {
    expect(nulSitesIn('probe.ts', Buffer.from("const a = 'null\\u0000byte'"))).toEqual([])
  })
})
