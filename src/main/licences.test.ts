import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import licences from '@shared/licences.json'
import { isCopyleft, type Licence } from '@shared/domain/licence'
import manifest from '../../package.json'

// Under `src/main` because `src/shared` compiles for the renderer, where `node:fs` has no types.
const ROOT = join(import.meta.dirname, '..', '..')
const entries: Licence[] = licences

const notices = readFileSync(join(ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8')
const licence = readFileSync(join(ROOT, 'LICENSE'), 'utf8')
const eula = readFileSync(join(ROOT, 'EULA.md'), 'utf8')

describe('the notice the repository carries', () => {
  // A stale copy would credit the wrong versions to whoever reads the repository, not the app.
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

// Three texts, three scopes; confusing them is the mistake worth guarding against.
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

  /**
   * electron-builder has no root `license` key: declaring one fails `validateConfiguration`
   * before any platform is packaged, so the mistake costs a whole release rather than one target.
   * Matched on the text — the schema lives in a dev dependency this project must not import.
   */
  it('offers the terms of use from where electron-builder accepts them', () => {
    const packaging = readFileSync(join(ROOT, 'electron-builder.yml'), 'utf8')

    expect(packaging).not.toMatch(/^license:/m)
    expect(packaging).toMatch(/^ {2}license: EULA\.md$/m)
  })
})
