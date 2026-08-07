import { describe, expect, it } from 'vitest'
import { memoryAdapter } from '@main/settings/memory-adapter'
import { createSettingsStore } from '@main/settings/store'
import {
  parseEnvFile,
  readEnvFile,
  readEnvironmentCredentials,
  resolveCredentials,
  type EnvironmentFallback,
} from './credentials'

const DEV_ENV = 'SCENARIO_API_KEY=env_key\nSCENARIO_API_SECRET=env_secret\n'

function fallback(content: string | null, packaged = false): EnvironmentFallback {
  return { packaged, read: () => content }
}

describe('env file parsing', () => {
  it('ignores comments and blank lines', () => {
    expect(parseEnvFile('# a comment\n\nA=1\n')).toEqual(new Map([['A', '1']]))
  })

  it('strips surrounding quotes', () => {
    expect(parseEnvFile('A="quoted"\nB=\'single\'').get('A')).toBe('quoted')
    expect(parseEnvFile("B='single'").get('B')).toBe('single')
  })

  it('keeps a value containing its own separators', () => {
    // A secret is an opaque string: `=` and `#` are legal characters in it.
    expect(parseEnvFile('A=a=b#c').get('A')).toBe('a=b#c')
  })

  it('skips a line with no assignment', () => {
    expect(parseEnvFile('nonsense\n=orphan\nA=1')).toEqual(new Map([['A', '1']]))
  })
})

describe('locating the development env file', () => {
  const disk =
    (files: Record<string, string>) =>
    (path: string): string | null =>
      files[path] ?? null

  const PROJECT = { '/project/package.json': '{}' }

  it('reads the file beside the starting folder', () => {
    expect(readEnvFile('/project', disk({ ...PROJECT, '/project/secrets/.env': 'here' }))).toBe(
      'here',
    )
  })

  it('climbs out of the bundled entry point folder', () => {
    // What development actually looks like: `app.getAppPath()` is `<project>/out/main`.
    const files = { ...PROJECT, '/project/secrets/.env': 'here' }
    expect(readEnvFile('/project/out/main', disk(files))).toBe('here')
  })

  it('stops at the volume root rather than looping', () => {
    expect(readEnvFile('/project/out/main', disk({}))).toBeNull()
  })

  /**
   * The whole point of stopping at the project root: another project's key spent silently is
   * worse than no key at all, which at least says so.
   */
  it('never reaches a secrets file living above the project', () => {
    const files = { ...PROJECT, '/secrets/.env': 'someone else' }
    expect(readEnvFile('/project/out/main', disk(files))).toBeNull()
  })

  it('takes the root nearest the starting folder', () => {
    const files = {
      '/project/out/package.json': '{}',
      '/project/out/secrets/.env': 'near',
      ...PROJECT,
      '/project/secrets/.env': 'far',
    }
    expect(readEnvFile('/project/out/main', disk(files))).toBe('near')
  })
})

describe('development credentials', () => {
  it('reads both variables from the file', () => {
    expect(readEnvironmentCredentials(fallback(DEV_ENV))).toEqual({
      key: 'env_key',
      secret: 'env_secret',
    })
  })

  it('never reads the file once the application is packaged', () => {
    expect(readEnvironmentCredentials(fallback(DEV_ENV, true))).toBeNull()
  })

  it('ignores a file that only carries half the pair', () => {
    expect(readEnvironmentCredentials(fallback('SCENARIO_API_KEY=env_key'))).toBeNull()
  })

  it('tolerates a missing file', () => {
    expect(readEnvironmentCredentials(fallback(null))).toBeNull()
  })
})

describe('credential resolution', () => {
  it('prefers what the user saved over the development fallback', () => {
    const settings = createSettingsStore(memoryAdapter())
    settings.setCredentials({ key: 'saved_key', secret: 'saved_secret' })

    expect(resolveCredentials(settings, fallback(DEV_ENV))).toEqual({
      key: 'saved_key',
      secret: 'saved_secret',
    })
  })

  it('falls back to the development file when nothing is saved', () => {
    expect(resolveCredentials(createSettingsStore(memoryAdapter()), fallback(DEV_ENV))).toEqual({
      key: 'env_key',
      secret: 'env_secret',
    })
  })

  it('resolves to nothing when neither source has credentials', () => {
    expect(resolveCredentials(createSettingsStore(memoryAdapter()), fallback(null))).toBeNull()
  })
})
