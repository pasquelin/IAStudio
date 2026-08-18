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
 * `git diff` answers « Binary file … differs », `git grep` skips it, and a reviewer asked to judge
 * it reports being unable to read it — which happened on 2026-08-18. The byte is legitimate as a
 * VALUE (a separator inside a key, an input a cleaner must refuse); what costs is spelling it as
 * the raw byte instead of the escape, which compiles to the very same string.
 *
 * **Refused wherever it sits, not only in the first 8 000 bytes git actually reads.** Both files
 * that carried it were identical in intent and only one was binary — the other sat past that
 * window and would have flipped the day a line was added above it. A rule hanging on a byte
 * offset holds until an unrelated edit.
 *
 * **Blind spot, written rather than discovered**: only the TypeScript of the four trees is swept.
 * `.ttf` and `.wasm` ship under `src/` and carry the byte legitimately, so widening this to every
 * file needs an exemption list — a different lot, and one that has to be argued.
 */
describe('no source spells the NUL byte as the byte itself', () => {
  const sourcesOf = (): string[] => PROJECT_TREES.flatMap(tree => testFilesUnder(tree, /\.tsx?$/))

  it(
    'holds every TypeScript source of the project, suites and fixtures included',
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
