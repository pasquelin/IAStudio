import { beforeEach, describe, expect, it } from 'vitest'
import { forgetConsentsForTests, mintConsent, splitConsent, takeConsent } from './wireConsent'
import { MOST_CALLS } from './batch'

describe('wireConsent', () => {
  beforeEach(forgetConsentsForTests)

  it('answers for the call it was minted for', () => {
    const token = mintConsent('document.save', { documentId: 'a' }, null)

    expect(takeConsent(token, 'document.save', { documentId: 'a' })).toEqual({ quoted: null })
  })

  it('does not answer for another call', () => {
    const token = mintConsent('files.trash', { paths: ['keep.png'] }, null)

    expect(takeConsent(token, 'files.trash', { paths: ['other.png'] })).toBeNull()
  })

  it('does not answer for another action', () => {
    const token = mintConsent('document.save', { documentId: 'a' }, null)

    expect(takeConsent(token, 'document.remove', { documentId: 'a' })).toBeNull()
  })

  it('reads the same call however its keys were ordered', () => {
    const token = mintConsent('files.move', { paths: ['a'], folder: 'Images' }, null)

    expect(takeConsent(token, 'files.move', { folder: 'Images', paths: ['a'] })).not.toBeNull()
  })

  it('spends once', () => {
    const token = mintConsent('document.save', { documentId: 'a' }, null)
    takeConsent(token, 'document.save', { documentId: 'a' })

    expect(takeConsent(token, 'document.save', { documentId: 'a' })).toBeNull()
  })

  // Or a client could sweep a token it holds across calls until one matched.
  it('burns a token offered against the wrong call', () => {
    const token = mintConsent('document.save', { documentId: 'a' }, null)
    takeConsent(token, 'document.save', { documentId: 'b' })

    expect(takeConsent(token, 'document.save', { documentId: 'a' })).toBeNull()
  })

  it('refuses a token it never minted', () => {
    expect(takeConsent('made-up', 'document.save', {})).toBeNull()
  })

  it('hands back the form that was priced, for the guard against a form that moved', () => {
    const quoted = { modelId: 'm', values: { numImages: 1 } }
    const token = mintConsent('generator.submit', {}, quoted)

    expect(takeConsent(token, 'generator.submit', {})).toEqual({ quoted })
  })

  /**
   * 🛑 Sized on the lot, not guessed: at 64 a second refused lot evicted the first one's tokens,
   * and the client looped on `needsConsent` with nothing saying why.
   */
  it('keeps two full lots of tokens standing at once', () => {
    const first = mintConsent('document.save', { documentId: 'first' }, null)
    for (let at = 1; at < MOST_CALLS * 2; at += 1) {
      mintConsent('document.save', { documentId: `${at}` }, null)
    }

    expect(takeConsent(first, 'document.save', { documentId: 'first' })).not.toBeNull()
  })

  it('holds the newest when a client asks without ever consenting', () => {
    const first = mintConsent('document.save', { documentId: 'first' }, null)
    for (let at = 0; at < MOST_CALLS * 2; at += 1) {
      mintConsent('document.save', { documentId: `${at}` }, null)
    }
    const last = mintConsent('document.save', { documentId: 'last' }, null)

    expect(takeConsent(first, 'document.save', { documentId: 'first' })).toBeNull()
    expect(takeConsent(last, 'document.save', { documentId: 'last' })).not.toBeNull()
  })

  describe('splitConsent', () => {
    it('holds the token apart from what the action reads', () => {
      expect(splitConsent({ documentId: 'a', consent: 'tok' })).toEqual({
        given: { documentId: 'a' },
        wire: { consent: 'tok' },
      })
    })

    it('says a call carries none rather than carrying an empty one', () => {
      expect(splitConsent({ documentId: 'a' })).toEqual({ given: { documentId: 'a' }, wire: {} })
    })

    // A number where a token belongs is a call with no token, not a call with a bad one.
    it('ignores a token that is not text', () => {
      expect(splitConsent({ consent: 7 }).wire).toEqual({})
    })
  })
})
