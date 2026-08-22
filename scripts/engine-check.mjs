/**
 * The sixth link of the gate, and the only one that looks at `engine/` — measured 2026-08-22: lint
 * and format read `{src,scripts}`, knip `src/main`, vitest `src`. `--locked` because `uv.lock` is
 * committed, and a manifest edited without relocking would resolve differently on the runner.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const STEPS = [
  ['ruff', 'check', 'engine'],
  ['ruff', 'format', '--check', 'engine'],
  ['pytest', 'engine/tests'],
]

for (const step of STEPS) {
  const { status, error } = spawnSync('uv', ['run', '--locked', '--project', 'engine', ...step], {
    cwd: ROOT,
    stdio: 'inherit',
  })

  // Named rather than left as a bare ENOENT: this is the one link whose tool the repository does
  // not install for you, and `pnpm install` gives no hint that it is missing.
  if (error) {
    process.stderr.write(
      `\nERROR: could not run uv — ${error.message}\n` +
        'The engine is Python, and uv drives its environment, its lint and its tests.\n' +
        'Install it from https://docs.astral.sh/uv/ and run `pnpm engine:check` again.\n\n',
    )
    process.exit(1)
  }

  if (status !== 0) process.exit(status ?? 1)
}
