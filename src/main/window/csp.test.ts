import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The window's Content Security Policy, read off the document that carries it.
 *
 * Read as data, and from the main process for the same reasons as `theme.test.ts`: the renderer
 * tests run in jsdom, where no file can be read — and every directive below was added because
 * something broke without it, silently, in a way only the running application showed.
 */
const policy = ((): string => {
  const html = readFileSync(new URL('../../renderer/index.html', import.meta.url), 'utf8')
  return /content="([^"]*)"/.exec(html)?.[1] ?? ''
})()

const directive = (name: string): string =>
  policy
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name} `)) ?? ''

describe('the window policy', () => {
  it('is declared at all', () => {
    expect(policy).not.toBe('')
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
