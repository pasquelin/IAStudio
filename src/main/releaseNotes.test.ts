import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '../../package.json'
import { releaseNotes } from './releaseNotes'

const ROOT = join(import.meta.dirname, '..', '..')
const read = (name: string) => readFileSync(join(ROOT, name), 'utf8')

const CHANGELOG = read('CHANGELOG.md')

describe('the release body', () => {
  it('exists for the version the repository carries', () => {
    // The `release` job refuses to publish without it — but only once the tag is pushed, three
    // platform builds late. Here it costs a gate.
    expect(releaseNotes(CHANGELOG, manifest.version)).not.toBe('')
  })

  it('stops at whatever closes its section', () => {
    const changelog = [
      '## [0.2.0]',
      'the new one',
      '',
      '## [0.1.0-rc.1]',
      'the candidate',
      '',
      '## [0.1.0]',
      'the final',
      '',
      '[0.1.0]: https://example/tag/v0.1.0',
    ].join('\n')

    expect(releaseNotes(changelog, '0.2.0')).toBe('the new one')
    // Two closings in one fixture: `0.1.0` opens with the same characters as `0.1.0-rc.1`, so the
    // closing bracket is what keeps a candidate from publishing the final notes — and the link
    // definitions at the foot would otherwise pile into the oldest section rather than the newest.
    expect(releaseNotes(changelog, '0.1.0')).toBe('the final')
  })

  it('is empty for a version nobody wrote about', () => {
    expect(releaseNotes(CHANGELOG, '99.0.0')).toBe('')
  })

  it('links out in full, a release page resolving nothing against the repository', () => {
    expect(releaseNotes(CHANGELOG, manifest.version)).not.toMatch(/]\((?!https?:)/)
  })
})

/**
 * That the job still calls it. Dropping the step, or going back to `--generate-notes`, leaves
 * `pnpm validate` green and shows up nowhere but the release page itself.
 *
 * Read as steps rather than as text: the comment above the step names `--generate-notes` to say
 * why it went, and a guard that a `#` disarms is one the next rebase disarms by accident.
 */
describe('the release job', () => {
  const steps = read('.github/workflows/release.yml')
    .split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n')

  it('takes its notes from the changelog, and writes none of its own', () => {
    expect(steps).toContain('node scripts/release-notes.mjs')
    expect(steps).not.toContain('--generate-notes')
  })
})
