import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ACCOUNT_NAME_MAX_LENGTH,
  DEFAULT_ENVIRONMENT_ACCOUNT_NAME,
  ENVIRONMENT_ACCOUNT_ID,
} from '@shared/domain/account'
import type { StoredAccount } from '@main/settings/accounts'

/**
 * How the development fallback reaches the disk. Injected so the resolution order can be
 * tested without a file system and without Electron.
 */
export type EnvironmentFallback = {
  packaged: boolean
  read: () => string | null
}

const ENV_FILE = join('secrets', '.env')
/** What marks the project root, and so how far up the search for the secrets may go. */
const MANIFEST_FILE = 'package.json'
const KEY_VARIABLE = 'PROVIDER_API_KEY'
const SECRET_VARIABLE = 'PROVIDER_API_SECRET'
/** Optional: what the development account is called in the switch, beside the stored ones. */
const NAME_VARIABLE = 'PROVIDER_ACCOUNT_NAME'

/**
 * What these three were called before 21/08. Read, never written — the same shape as
 * `LEGACY_MANIFEST_FILE`.
 *
 * `secrets/.env` is git-ignored, so the rename could not reach a single real one: every existing
 * checkout and worktree would have come up "not connected" with nothing anywhere saying why, which
 * is precisely the silent failure this file exists to prevent.
 */
const PREVIOUS_NAMES: Record<string, string> = {
  [KEY_VARIABLE]: 'SCENARIO_API_KEY',
  [SECRET_VARIABLE]: 'SCENARIO_API_SECRET',
  [NAME_VARIABLE]: 'SCENARIO_ACCOUNT_NAME',
}

/** The current name wins, so a `.env` carrying both is never ambiguous. */
const read = (variables: Map<string, string>, name: string): string | undefined =>
  variables.get(name) ?? variables.get(PREVIOUS_NAMES[name] ?? '')

function unquote(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted?.[2] ?? value
}

/** Minimal `.env` reader. A secret may legitimately contain `#`, so nothing is stripped. */
export function parseEnvFile(content: string): Map<string, string> {
  const variables = new Map<string, string>()

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue

    variables.set(trimmed.slice(0, separator).trim(), unquote(trimmed.slice(separator + 1).trim()))
  }

  return variables
}

/**
 * The account `secrets/.env` stands for, in development only. The file is read at runtime and
 * never passed to the bundler: a secret injected at build time is written into `out/`, and an
 * `.asar` opens in a text editor.
 *
 * An account rather than a bare pair, so that a checkout with a `.env` and a machine holding
 * several stored keys are the same situation — one list, one switch — instead of a fallback
 * that works while showing nothing anywhere.
 */
export function environmentAccount(fallback: EnvironmentFallback): StoredAccount | null {
  if (fallback.packaged) return null

  const content = fallback.read()
  if (content === null) return null

  const variables = parseEnvFile(content)
  const key = read(variables, KEY_VARIABLE)
  const secret = read(variables, SECRET_VARIABLE)
  if (!key || !secret) return null

  // Clamped, not refused: a name too long is a `.env` to tidy up, never a reason to withhold
  // the only key a fresh checkout has.
  const named = read(variables, NAME_VARIABLE)?.trim().slice(0, ACCOUNT_NAME_MAX_LENGTH)

  return {
    id: ENVIRONMENT_ACCOUNT_ID,
    name: named || DEFAULT_ENVIRONMENT_ACCOUNT_NAME,
    credentials: { key, secret },
    origin: 'environment',
  }
}

/**
 * Reads `secrets/.env` from the project root — the nearest folder at or above `start` holding
 * a `package.json`.
 *
 * The climb is what makes the file reachable at all: in development electron-vite runs the
 * bundled entry point, so `app.getAppPath()` is `<project>/out/main`, two levels below the
 * folder the secrets live in.
 *
 * The climb STOPS at that root rather than walking to the volume's: a stray `secrets/.env` in
 * a parent folder would otherwise be picked up in silence, and the studio would spend another
 * project's API key without ever saying whose.
 */
export function readEnvFile(start: string, read: (path: string) => string | null): string | null {
  let current = start

  for (;;) {
    if (read(join(current, MANIFEST_FILE)) !== null) return read(join(current, ENV_FILE))

    const parent = dirname(current)
    // No project root above: the user is expected to type their own credentials.
    if (parent === current) return null
    current = parent
  }
}

export function createFileSystemFallback(
  startPath: string,
  packaged: boolean,
): EnvironmentFallback {
  return {
    packaged,
    read: () =>
      readEnvFile(startPath, path => {
        try {
          return readFileSync(path, 'utf8')
        } catch {
          return null
        }
      }),
  }
}
