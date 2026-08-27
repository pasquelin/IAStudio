import { describe, expect, it } from 'vitest'
import { WINDOW_SOURCES } from '@/windowSources'
import source from './documents.tsx?raw'

/** The paths `documents.tsx` lazily imports, read off the file rather than listed here. */
const spaces = (): string[] =>
  [...source.matchAll(/import\('@\/spaces\/([^']+)'\)/g)].map(one => one[1] ?? '')

const sourceOf = (space: string): string => {
  const held = WINDOW_SOURCES[`./spaces/${space}.tsx`]
  // Told apart from a missing hook: a space that moved on disk would otherwise send its owner
  // adding a call that is already there.
  expect(held, `no source for ${space}`).toBeDefined()
  return held ?? ''
}

/**
 * 🛑 The two hooks a document component cannot forget, and nothing else says so. Without the
 * first the tab opens on the space's default instead of the file; without the second it never
 * says the document is unsaved. Each has already been missed by more than one space.
 */
const REQUIRED = ['useRestoredDocument(', 'useDocumentTitle(']

describe('every space that renders a document', () => {
  it.each(REQUIRED)('calls %s', hook => {
    expect(spaces().filter(space => !sourceOf(space).includes(hook))).toEqual([])
  })

  /** Not the `Record<DocumentKind, …>` over again — this is what stops the cases above from
   * passing on an empty list the day the regex above stops matching. */
  it('finds every space the centre draws', () => {
    expect(spaces().length).toBeGreaterThanOrEqual(7)
  })
})
