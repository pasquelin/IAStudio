import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

/**
 * The tree removed on 2026-08-11, and the manifest script that rebuilt it.
 *
 * BOTH, because a first version of this guard searched the path alone and found five lines out of
 * eight: the manifest entry, the readme row and a `.gitignore` comment name the COMMAND, and would
 * have survived a green run — the one site able to bring the whole tree back among them.
 */
const REMOVED = ['docs/scenario-api', 'docs:scenario']

/**
 * Every tracked line naming either, as `path:line:text` — git's own search, so binaries and
 * untracked files stay out and no walk is written twice.
 *
 * `git grep` EXITS 1 on no match, which `execFileSync` raises: an unguarded call would fail the
 * suite on exactly the state this guard wants to see. This file is excluded from its own sweep.
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
  } catch {
    return []
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
