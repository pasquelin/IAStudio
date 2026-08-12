import { describe, expect, it } from 'vitest'
import {
  cachedToken,
  memoPalette,
  onPaletteChange,
  refreshPalette,
  rootColour,
  rootFont,
  token,
  tokenAsHex,
} from './palette'

function element(style: string): HTMLElement {
  const node = document.createElement('div')
  node.setAttribute('style', style)
  document.body.appendChild(node)
  return node
}

describe('reading a token', () => {
  it('trims what the stylesheet answers, so a value never carries its indentation', () => {
    expect(token(element('--sample:  #123456  '), '--sample')).toBe('#123456')
  })

  it('answers empty for a token nothing declares, leaving the fallback to the caller', () => {
    expect(token(element(''), '--absent')).toBe('')
  })
})

describe('reading a token as a number', () => {
  it('parses the hex an engine needs', () => {
    expect(tokenAsHex(element('--sample: #3574f0'), '--sample', 0)).toBe(0x3574f0)
  })

  it('falls back rather than painting a silent black when the token is missing', () => {
    expect(tokenAsHex(element(''), '--absent', 0xff00ff)).toBe(0xff00ff)
  })

  it('falls back for a token that is not a hex colour at all', () => {
    expect(tokenAsHex(element('--sample: rebeccapurple'), '--sample', 0xff00ff)).toBe(0xff00ff)
  })
})

describe('following a theme change', () => {
  it('notifies every subscriber, so no engine is the one surface left behind', () => {
    const seen: string[] = []
    const stopFirst = onPaletteChange(() => seen.push('first'))
    const stopSecond = onPaletteChange(() => seen.push('second'))

    refreshPalette()

    expect(seen).toEqual(['first', 'second'])
    stopFirst()
    stopSecond()
  })

  it('stops notifying an engine that has been disposed', () => {
    let calls = 0
    const stop = onPaletteChange(() => void (calls += 1))

    refreshPalette()
    stop()
    refreshPalette()

    // A disposed engine still subscribed would read tokens off a canvas it no longer owns.
    expect(calls).toBe(1)
  })

  it('notifies nobody when nothing is mounted, rather than throwing', () => {
    expect(() => refreshPalette()).not.toThrow()
  })
})

describe('caching a root token', () => {
  it('reads the stylesheet once, however many callers ask', () => {
    document.documentElement.style.setProperty('--cached-sample', '#111111')
    expect(cachedToken('--cached-sample')).toBe('#111111')

    // Changed underneath without a theme change: the cache is what is being observed here, and
    // a second read must not go back to the stylesheet.
    document.documentElement.style.setProperty('--cached-sample', '#222222')
    expect(cachedToken('--cached-sample')).toBe('#111111')

    refreshPalette()
    expect(cachedToken('--cached-sample')).toBe('#222222')
  })

  it('caches the absence of a token too, rather than asking again every time', () => {
    expect(cachedToken('--never-declared')).toBe('')
    expect(cachedToken('--never-declared')).toBe('')
  })
})

describe('what a painter reads off the root', () => {
  it('answers black for a token nothing declares, rather than an empty fill', () => {
    // An empty string assigned to `fillStyle` is IGNORED by the 2D context, which then paints
    // with whatever colour the previous draw left there.
    expect(rootColour('--absent-colour')).toBe('#000')
  })

  it('answers the token when there is one', () => {
    document.documentElement.style.setProperty('--painter-sample', '#3574f0')
    refreshPalette()

    // Restored even on a failed assertion: the root is shared and so is the cache, so leaking
    // either would fail the NEXT test and accuse the wrong code.
    try {
      expect(rootColour('--painter-sample')).toBe('#3574f0')
    } finally {
      document.documentElement.style.removeProperty('--painter-sample')
      refreshPalette()
    }
  })

  it('composes a font shorthand, and keeps the shipped size when no token answers', () => {
    document.documentElement.style.setProperty('--painter-step', '22px')
    refreshPalette()

    try {
      expect(rootFont('--painter-step', '11px', 'monospace')).toBe('22px monospace')
      // A shorthand with no size is rejected whole, and the canvas keeps the font it had.
      expect(rootFont('--absent-step', '11px', 'monospace')).toBe('11px monospace')
    } finally {
      document.documentElement.style.removeProperty('--painter-step')
      refreshPalette()
    }
  })
})

describe('a memoised palette', () => {
  it('computes once for however many paints, and again once the theme has moved', () => {
    let computed = 0
    const read = memoPalette(() => ({ nth: (computed += 1) }))

    expect(read().nth).toBe(1)
    expect(read().nth).toBe(1)

    refreshPalette()

    // Without this a painter keeps the colours of the theme the user just left.
    expect(read().nth).toBe(2)
  })

  it('computes nothing until something paints, so an unmounted module reads no stylesheet', () => {
    let computed = 0
    memoPalette(() => (computed += 1))

    expect(computed).toBe(0)
  })

  it('memoises a palette that comes out null, rather than recomputing it every paint', () => {
    let computed = 0
    const read = memoPalette(() => {
      computed += 1
      return null
    })

    read()
    read()

    // Held bare, `cached ??= compute()` would answer null, look empty, and read the stylesheet
    // again on every frame while reporting itself as cached.
    expect(computed).toBe(1)
  })
})
