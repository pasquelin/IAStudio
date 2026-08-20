/**
 * Prints the release body for a version, read from `CHANGELOG.md`.
 *
 * Called by the `release` job of `.github/workflows/release.yml`, which pipes it into
 * `gh release create --notes-file`. That job runs no `pnpm install`, so nothing here may reach
 * outside Node.
 *
 * The rule itself is `src/main/releaseNotes.ts`, where the suite can reach it — this file only
 * points it at the changelog and turns its answer into an exit code.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// A `.ts` from a `.mjs`: Node 24 strips the types on the way in, and the rule the tests check is
// then the one that runs.
import { releaseNotes } from '../src/main/releaseNotes.ts'

const version = process.argv[2]

if (!version) {
  console.error('Usage: node scripts/release-notes.mjs <version>   # the tag without its leading v')
  process.exit(1)
}

const changelog = readFileSync(join(import.meta.dirname, '..', 'CHANGELOG.md'), 'utf8')
const notes = releaseNotes(changelog, version)

if (notes === '') {
  console.error(
    `CHANGELOG.md has no '## [${version}]' section, or that section is empty.\n` +
      'The release body would be empty, and it is the first thing a reader opens. Write the\n' +
      'section, move the tag, and run again — see docs/ci/RELEASE.md.',
  )
  process.exit(1)
}

console.log(notes)
