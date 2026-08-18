import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

/**
 * The tree removed on 2026-08-11, and the manifest script that rebuilt it — BOTH, since the three
 * sites able to bring it back name the command and never the path.
 */
const REMOVED = ['docs/scenario-api', 'docs:scenario']

/** `git grep` saying « no match », and nothing else it can fail with. */
const foundNothing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && error.status === 1

/**
 * Every tracked line naming either, as `path:line:text` — git's own search, so binaries and
 * untracked files stay out and no walk is written twice.
 *
 * `git grep` EXITS 1 on no match, which `execFileSync` raises: an unguarded call would fail the
 * suite on exactly the state this guard wants to see. Status 1 and NOTHING else — a broken
 * pathspec exits 128 and a missing binary throws `ENOENT`, both of which a blanket `catch` would
 * turn into the green this guard exists to refuse. This file is excluded from its own sweep.
 */
function namingTheRemovedTree(): string[] {
  try {
    return execFileSync(
      'git',
      [
        'grep',
        '-In',
        ...REMOVED.flatMap(needle => ['-e', needle]),
        '--',
        '.',
        ':(exclude)src/main/no-scenario-api-docs.test.ts',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    if (foundNothing(error)) return []
    throw error
  }
}

/**
 * The Scenario API is asked of the MCP, never of a copy of its documentation kept here.
 *
 * The copy was removed on 2026-08-11 because it described the structure correctly and got the
 * VALUES wrong twice; a reader sent to a path that no longer exists cannot even tell that it is
 * gone. Eight lines still named it a week later, one of them a manifest script able to bring the
 * whole tree back in one command.
 *
 * **Blind spots, written rather than discovered.** What git does not track is not read — and
 * `CLAUDE.md`, which is ignored, names the tree on purpose to forbid it. A reference that spells
 * the path differently (`docs/scenario_api`, or the URL it was scraped from) passes.
 */
describe('no tracked file sends a reader to the removed API documentation', () => {
  it('names it nowhere — not in a source, a manifest, a script or a readme', () => {
    expect(namingTheRemovedTree()).toEqual([])
  })

  // An empty result proves nothing unless git answered: pointed at a pattern nobody writes, the
  // assertion above stays green for the wrong reason.
  it('searches the tracked tree, and finds what is there', () => {
    expect(
      execFileSync('git', ['grep', '-Il', 'scenario'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
        .length,
    ).toBeGreaterThan(10)
  })
})
