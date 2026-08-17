import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '../../package.json'

const ROOT = join(import.meta.dirname, '..', '..')

/**
 * Read as steps, not as text: a commented-out `# - run: …` still holds the words. Both idioms
 * count — `- run: x` and the `run: x` that sits under a `- name:`, which `release.yml` already
 * uses and which a first version of this guard was blind to.
 *
 * **Blind spot, and it is real**: a `run: |` block puts its commands on the lines below, which
 * nothing here reads. `release.yml` uses that form too. A link of the gate hidden in such a block
 * would pass this guard.
 */
const runSteps = (): string[] =>
  readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('run:') || line.startsWith('- run:'))
    .map(line => line.replace(/^(- )?run:/, '').trim())
    .filter(Boolean)

const gateLinks = (): string[] => manifest.scripts.validate.split('&&').map(link => link.trim())

describe('the integration job running the gate rather than a copy of it', () => {
  it('calls the gate by name', () => {
    expect(runSteps()).toContain('pnpm validate')
  })

  /**
   * The trap this repository fell into: the job spelled the four links out by hand, a fifth was
   * added to `validate`, and pull requests kept passing with dead code while the desk went red.
   * Derived from the manifest, so a sixth link is covered the day it is written.
   */
  it('runs no link of the gate on its own, whatever the links become', () => {
    for (const link of gateLinks()) expect(runSteps()).not.toContain(link)
  })
})
