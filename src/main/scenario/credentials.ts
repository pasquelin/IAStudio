import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Credentials, SettingsStore } from '@main/settings/store'

/**
 * How the development fallback reaches the disk. Injected so the resolution order can be
 * tested without a file system and without Electron.
 */
export type EnvironmentFallback = {
  packaged: boolean
  read: () => string | null
}

const ENV_FILE = join('secrets', '.env')
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

export function createFileSystemFallback(rootPath: string, packaged: boolean): EnvironmentFallback {
  return {
    packaged,
    read: () => {
      try {
        return readFileSync(join(rootPath, ENV_FILE), 'utf8')
      } catch {
        // No development secrets: the user is expected to type their own.
        return null
      }
    },
  }
}
