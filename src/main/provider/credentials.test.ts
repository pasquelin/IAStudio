import { describe, expect, it } from 'vitest'
import { ACCOUNT_NAME_MAX_LENGTH, ENVIRONMENT_ACCOUNT_ID } from '@shared/domain/account'
import {
  environmentAccount,
  parseEnvFile,
  readEnvFile,
  type EnvironmentFallback,
} from './credentials'

const DEV_ENV = 'PROVIDER_API_KEY=env_key\nPROVIDER_API_SECRET=env_secret\n'

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

describe('the development account', () => {
  it('reads the credentials from the file', () => {
    expect(environmentAccount(fallback(DEV_ENV))?.credentials).toEqual({
      key: 'env_key',
      secret: 'env_secret',
    })
  })

  // The origin is what decides both the permission and whether it may be persisted, and the id
  // is fixed because activating it has to survive a relaunch.
  it('carries its origin and keeps a fixed id', () => {
    const account = environmentAccount(fallback(DEV_ENV))

    expect(account).toMatchObject({ id: ENVIRONMENT_ACCOUNT_ID, origin: 'environment' })
  })

  it('takes its name from the file', () => {
    const named = `${DEV_ENV}PROVIDER_ACCOUNT_NAME=Développement\n`

    expect(environmentAccount(fallback(named))?.name).toBe('Développement')
  })

  it('falls back to a default name when the file does not give one', () => {
    expect(environmentAccount(fallback(DEV_ENV))?.name).toBe('Development')
    expect(environmentAccount(fallback(`${DEV_ENV}PROVIDER_ACCOUNT_NAME=   \n`))?.name).toBe(
      'Development',
    )
  })

  // A `.env` to tidy up is never a reason to withhold the only key a fresh checkout has.
  it('clamps a name too long rather than refusing the account', () => {
    const long = `${DEV_ENV}PROVIDER_ACCOUNT_NAME=${'n'.repeat(200)}\n`

    expect(environmentAccount(fallback(long))?.name).toHaveLength(ACCOUNT_NAME_MAX_LENGTH)
  })

  it('never reads the file once the application is packaged', () => {
    expect(environmentAccount(fallback(DEV_ENV, true))).toBeNull()
  })

  it('ignores a file that only carries half the pair', () => {
    expect(environmentAccount(fallback('PROVIDER_API_KEY=env_key'))).toBeNull()
  })

  it('tolerates a missing file', () => {
    expect(environmentAccount(fallback(null))).toBeNull()
  })
})
