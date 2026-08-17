import { describe, expect, it } from 'vitest'
import {
  parseBlobRef,
  parseCredential,
  parseGitPaths,
  parseHost,
  parseLogPage,
  parseOptionalHash,
  parseRemoteUrl,
} from './validation'

/**
 * The boundary, and the only place the studio treats what a window sends as hostile.
 *
 * Every value below becomes an argument to a process that writes, or a line in the environment
 * of one. What each case here holds is a way of turning a string into an execution — none is
 * theoretical, and all of them are one character away from a value somebody would type.
 */
describe('the paths a gesture may touch', () => {
  it('takes an ordinary path inside the project', () => {
    expect(parseGitPaths(['documents/board.scimg'])).toEqual(['documents/board.scimg'])
  })

  it.each([
    ['/etc/passwd', 'an absolute path'],
    ['../../.ssh/id_rsa', 'a path that climbs out'],
    ['documents/../../secrets', 'one that climbs out halfway through'],
    ['--upload-pack=touch /tmp/pwned', 'a value git would read as an option'],
  ])('refuses %s — %s', path => {
    expect(() => parseGitPaths([path])).toThrow()
  })

  it('refuses an empty list, which no gesture ever means', () => {
    expect(() => parseGitPaths([])).toThrow()
  })
})

describe('the version a comparison names', () => {
  it('takes a hash, and nothing for the working copy', () => {
    expect(parseOptionalHash('a3f9c1e')).toBe('a3f9c1e')
    expect(parseOptionalHash(null)).toBeNull()
  })

  /** `git show --upload-pack=…` runs a command of the caller's choosing. */
  it('refuses anything that is not hexadecimal', () => {
    expect(() => parseOptionalHash('--upload-pack=evil')).toThrow()
    expect(() => parseOptionalHash('HEAD; rm -rf /')).toThrow()
  })

  /** `undefined` would let a caller that simply forgot the argument mean "the working copy". */
  it('refuses undefined, which is not the same as naming no version', () => {
    expect(() => parseOptionalHash(undefined)).toThrow()
  })
})

/**
 * Where the BYTES come from, which is the wider question — and the one that was refused whole.
 *
 * The picture comparison asks for `HEAD` and for a commit's first parent, and the boundary was
 * checking them against the hash rule: both were rejected, every time, so the earlier half of
 * every picture comparison came back empty and the pane said the comparison was unavailable.
 */
describe('the version a picture is read at', () => {
  it('takes the two spellings the comparison asks for, beside a hash', () => {
    expect(parseBlobRef('HEAD')).toBe('HEAD')
    expect(parseBlobRef('a3f9c1e^')).toBe('a3f9c1e^')
    expect(parseBlobRef('a3f9c1e')).toBe('a3f9c1e')
    expect(parseBlobRef(null)).toBeNull()
  })

  /** The same door `parseOptionalHash` closes: an argument beginning with `-` is an option. */
  it('refuses every other revision spelling, and anything that could be an option', () => {
    expect(() => parseBlobRef('--upload-pack=evil')).toThrow()
    expect(() => parseBlobRef('HEAD~3')).toThrow()
    expect(() => parseBlobRef('HEAD; rm -rf /')).toThrow()
    expect(() => parseBlobRef('main')).toThrow()
  })
})

describe('how much history is asked for', () => {
  it('takes whole numbers within its bounds', () => {
    expect(parseLogPage(60, 120)).toEqual({ limit: 60, skip: 120 })
  })

  /** Both are interpolated into `--max-count=`, where anything else is a second argument. */
  it.each([
    ['1e9', 0],
    [1.5, 0],
    [-1, 0],
    [60, -1],
  ])('refuses %s / %s', (limit, skip) => {
    expect(() => parseLogPage(limit, skip)).toThrow()
  })
})

describe('where a remote lives', () => {
  it.each([
    'https://github.com/alban/projet.git',
    'http://git.company.fr/projet.git',
    'ssh://git@github.com/alban/projet.git',
    'git@github.com:alban/projet.git',
  ])('takes %s', url => {
    expect(parseRemoteUrl(url)).toBe(url)
  })

  /**
   * `ext::` RUNS A COMMAND the URL contains, and `file://` turns a clone into a read of any path
   * on the machine. Neither is something anybody types into a version panel, and both are how a
   * pasted string becomes an execution.
   */
  it.each([
    ['ext::sh -c touch% /tmp/pwned', 'a transport that runs a command'],
    ['file:///etc', 'a transport that reads the machine'],
    ['--upload-pack=evil', 'a value git would read as an option'],
    ['https://github.com/a b', 'a space, which would split into two arguments'],
  ])('refuses %s — %s', url => {
    expect(() => parseRemoteUrl(url)).toThrow()
  })
})

describe('the server a token belongs to', () => {
  it('takes a host, with a port where there is one', () => {
    expect(parseHost('github.com')).toBe('github.com')
    expect(parseHost('git.company.fr:8443')).toBe('git.company.fr:8443')
  })

  it('refuses anything carrying a scheme, a path or a credential', () => {
    expect(() => parseHost('https://github.com')).toThrow()
    expect(() => parseHost('github.com/alban')).toThrow()
    expect(() => parseHost('user:pass@github.com')).toThrow()
  })
})

describe('a token on its way in', () => {
  it('takes a name and a token', () => {
    expect(parseCredential('alban', 'ghp_secret')).toEqual({ user: 'alban', token: 'ghp_secret' })
  })

  /**
   * Both are written into the environment of a child process, where the credential helper echoes
   * them line by line. A newline inside one would end that line and let what follows be read as
   * the next field git asked for.
   */
  it('refuses a newline, which would forge a second field', () => {
    expect(() => parseCredential('alban', 'ghp_a\npassword=other')).toThrow()
    expect(() => parseCredential('alban\nx', 'ghp_a')).toThrow()
  })

  it('refuses an empty token, which would be stored as if it worked', () => {
    expect(() => parseCredential('alban', '')).toThrow()
  })
})
