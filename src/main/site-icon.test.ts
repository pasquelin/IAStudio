import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * GitHub Pages serves nothing above `docs/`, so the site's favicon is a COPY of the application
 * icon rather than a link to it, and nothing else compares the two.
 *
 * **The blind spot, in the open**: `apple-touch-icon.png` beside it is a flattened RENDER of that
 * same file, and no test reopens it — a stale one shows on an iOS home screen and nowhere else.
 */
const fileAt = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('the site icon', () => {
  it('is the application icon itself', () => {
    expect(fileAt('docs/assets/images/icon.svg')).toBe(fileAt('build/icon.svg'))
  })

  // Two empty files are equal too: the case above passes on a pair of them.
  it('draws the mark rather than nothing', () => {
    expect(fileAt('build/icon.svg')).toContain('#346ef2')
  })

  it('is what the page links to', () => {
    expect(fileAt('docs/index.html')).toContain('href="assets/images/icon.svg"')
  })
})
