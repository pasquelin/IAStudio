/**
 * Refuses to publish a release whose auto-update manifests are incomplete.
 *
 * Called by the `release` job of `.github/workflows/release.yml`, on the folder the three
 * platforms' artefacts were merged into. That job runs no `pnpm install`, so nothing here may
 * reach outside Node.
 *
 * The rule itself is `src/main/updateManifests.ts`, where the suite can reach it — this file
 * only points it at `dist/` and turns its answer into an exit code.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
// A `.ts` from a `.mjs`: Node 24 strips the types on the way in, and the rule the tests check is
// then the one that runs.
import { blockMapsExpected } from '../src/main/updateManifests.ts'

const MANIFESTS = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']

const dist = process.argv[2]

if (!dist) {
  console.error('Usage: node scripts/check-manifests.mjs <folder>   # where the artefacts landed')
  process.exit(1)
}

const missing = MANIFESTS.filter(name => !existsSync(join(dist, name)))

if (missing.length > 0) {
  console.error(
    `Missing update manifests: ${missing.join(', ')}\n` +
      'A release without them breaks auto-update for every installed client, and does so\n' +
      'silently — the server answers 404 and the app says nothing. Publishing is refused.\n' +
      'See docs/ci/adr/ADR-06-publication-des-artefacts.md.',
  )
  process.exit(1)
}

let refused = false

for (const name of MANIFESTS) {
  const manifest = readFileSync(join(dist, name), 'utf8')

  for (const blockMap of blockMapsExpected(manifest)) {
    if (existsSync(join(dist, blockMap))) continue
    console.error(
      `${name} lists a file whose block map is not beside it: ${blockMap}\n` +
        'The client hangs on "Download block maps" instead of falling back to a full download.',
    )
    refused = true
  }

  const version = /^version:\s*(.+)$/m.exec(manifest)?.[1]
  console.log(`${name}: version ${version ?? 'unknown'}, block maps accounted for.`)
}

if (refused) process.exit(1)
