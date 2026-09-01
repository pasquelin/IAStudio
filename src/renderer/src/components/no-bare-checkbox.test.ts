import { describe, expect, it } from 'vitest'

/**
 * Every source of the window, read whole: a checkbox composed by hand is invisible to a run that
 * only imports what a test touches, and this is exactly the kind of drift nothing else sees.
 */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const CHECKBOX_ELEMENT = /<input\b[^>]*?type="checkbox"[^>]*?\/>/gs

/** Its OWN class attribute — braced or quoted — and nothing else of the element. */
const CLASS_ATTRIBUTE = /className=(?:\{([^}]*(?:\}[^}]*)*?)\}|"([^"]*)")/s

/** The dock's own ink, and the WINDOW's, which is DaisyUI — settings, dialogs, onboarding. */
const INKED = /\bCHECKBOX\b|\b(?:checkbox|toggle)(?:\s|-)/

/**
 * 🛑 MEASURED on screen: the generation form composed `size-4 self-start` by hand, so its boxes
 * wore `accent-color: auto` — the BROWSER's blue against the studio's `#346ef2` — and no pointer
 * cursor. Two blues in one panel, and every gate was green on it.
 *
 * 🛑 The CLASS, never the file and never the element: read against the whole source, an unused
 * import of the token passed; read against the element, a COMMENT naming the token passed. Both
 * measured while writing this.
 *
 * 🛑 What it does not see, written rather than hidden: a class built in a variable above the box,
 * and one spread from props. Both are reachable; neither is written that way today.
 */
describe('a checkbox of the window', () => {
  it('is inked by a language, never by classes of its own', () => {
    const bare = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('.test.'))
      .flatMap(([path, source]) =>
        [...source.matchAll(CHECKBOX_ELEMENT)]
          .map(([element]) => CLASS_ATTRIBUTE.exec(element))
          .filter(found => !INKED.test(found?.[1] ?? found?.[2] ?? ''))
          .map(() => path),
      )

    expect(bare).toEqual([])
  })
})
