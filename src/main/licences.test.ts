import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import licences from '@shared/licences.json'
import { isCopyleft, type Licence } from '@shared/domain/licence'
import manifest from '../../package.json'

/**
 * What the repository says about its terms, checked against what the Licences window shows.
 *
 * Under `src/main` rather than beside `licence.ts`: `src/shared` compiles for the renderer too,
 * where `node:fs` has no types, and the files under test sit on disk. This is the nearest project
 * whose tests may read one — the subject is the repository, not any one module of the main.
 */
const ROOT = join(import.meta.dirname, '..', '..')
const entries: Licence[] = licences

const notices = readFileSync(join(ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8')
const licence = readFileSync(join(ROOT, 'LICENSE'), 'utf8')
const eula = readFileSync(join(ROOT, 'EULA.md'), 'utf8')

describe('the notice the repository carries', () => {
  // Generated beside `licences.json` by `pnpm licences:collect`. A stale copy would credit the
  // wrong versions to whoever reads the release page rather than the running application.
  it('mirrors every entry of the window, version and licence included', () => {
    for (const entry of entries) {
      expect(notices, `${entry.name} is missing from THIRD-PARTY-NOTICES.md`).toContain(
        `## ${entry.name}\n`,
      )
      expect(notices).toContain(`| ${entry.name} | ${entry.version} | ${entry.spdx} |`)
    }
  })

  // The offer is the whole point of the file for these two: attribution alone would not do.
  it('carries the source offer of every copyleft component', () => {
    const copyleft = entries.filter(entry => isCopyleft(entry.spdx))
    expect(copyleft.length).toBeGreaterThan(0)

    for (const entry of copyleft) {
      expect(notices, `${entry.name} lost its source offer`).toContain(entry.sources ?? '')
    }
  })
})

/**
 * Three texts, three scopes. Confusing them is the mistake worth guarding against: the repository
 * is source-available, the installed application is not, and neither says anything about the
 * third-party software both of them carry.
 */
describe('the terms the project ships under', () => {
  it('declares in the manifest the licence the repository actually carries', () => {
    expect(manifest.license).toBe('PolyForm-Noncommercial-1.0.0')
    expect(licence).toContain('# PolyForm Noncommercial License 1.0.0')
    expect(licence).toContain('Required Notice: Copyright 2026 Alban Pasquelin')
  })

  it('keeps the repository licence clear of what it does not cover', () => {
    expect(licence).toContain('THIRD-PARTY-NOTICES.md')
    expect(licence).toContain('EULA.md')
  })

  it('governs the binary by its own terms, which name the FFmpeg offer', () => {
    expect(eula).toContain('THIRD-PARTY-NOTICES.md')
    // The one obligation the terms of use must not read as narrowing.
    expect(eula).toContain('FFmpeg')
  })
})
