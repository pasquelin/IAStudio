import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The policies, read as data — and from the main process for the reasons `theme.test.ts` gives.
 * Every directive below was added because something broke silently without it.
 */
function policyOf(page: string): string {
  const html = readFileSync(new URL(`../../renderer/${page}`, import.meta.url), 'utf8')
  // Anchored on the directive: any other `content=` attribute would otherwise match first.
  const meta = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/.exec(html)?.[0] ?? ''
  return /content="([^"]*)"/.exec(meta)?.[1] ?? ''
}

const policy = policyOf('index.html')

const directive = (name: string): string =>
  policy
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name} `)) ?? ''

describe('the window policy', () => {
  it('is declared at all', () => {
    expect(policy).not.toBe('')
  })

  // The splash has no scripts of its own and must stay that way — it shows before anything is
  // trusted, and it is the one window that never needs to reach the network.
  it('keeps the splash screen shut', () => {
    expect(policyOf('splash.html')).toContain("default-src 'none'")
  })

  /**
   * Mediabunny decodes on workers it creates from blobs. Without this the monitor decodes
   * nothing and the console fills with policy violations — which is how this was found.
   */
  it('lets the decoder start its workers', () => {
    expect(directive('worker-src')).toContain('blob:')
  })

  // The asset scheme is fetched, not just linked: the monitor reads a rush through it.
  it('lets the asset scheme be fetched and shown', () => {
    expect(directive('connect-src')).toContain('scenario:')
    expect(directive('img-src')).toContain('scenario:')
    expect(directive('media-src')).toContain('scenario:')
  })

  // Nothing runs that the application did not ship. Pixi builds its shaders with `new Function`
  // and is given static polyfills instead — see `engines/core/mount.ts`.
  it('keeps scripts to the application itself', () => {
    expect(directive('script-src')).toBe("script-src 'self'")
  })
})
