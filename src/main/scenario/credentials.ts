import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SettingsStore } from '@main/settings/store'
import type { Credentials } from '@main/settings/validation'

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
const KEY_VARIABLE = 'SCENARIO_API_KEY'
const SECRET_VARIABLE = 'SCENARIO_API_SECRET'

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
 * Reads `secrets/.env`, in development only. The file is read at runtime and never passed to
 * the bundler: a secret injected at build time is written into `out/`, and an `.asar` opens
 * in a text editor.
 */
export function readEnvironmentCredentials(fallback: EnvironmentFallback): Credentials | null {
  if (fallback.packaged) return null

  const content = fallback.read()
  if (content === null) return null

  const variables = parseEnvFile(content)
  const key = variables.get(KEY_VARIABLE)
  const secret = variables.get(SECRET_VARIABLE)

  return key && secret ? { key, secret } : null
}

/** Saved credentials win over the development fallback — what the user typed is the truth. */
export function resolveCredentials(
  settings: SettingsStore,
  fallback: EnvironmentFallback,
): Credentials | null {
  return settings.readCredentials() ?? readEnvironmentCredentials(fallback)
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
