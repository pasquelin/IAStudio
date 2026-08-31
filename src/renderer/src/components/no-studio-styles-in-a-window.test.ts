import { describe, expect, it } from 'vitest'
import { WINDOW_SOURCES } from '../windowSources'

/**
 * The mirror of `windowStyles.test.ts`, in the other direction.
 *
 * `styles.ts` holds what the components of the DOCKS share, and its strings speak the studio's own
 * names — `bg-elevated`, `text-muted`, `bg-surface` — which the `@theme` declares and DaisyUI has
 * never heard of. A window that is not a dock reaching for them puts the two vocabularies in one
 * bag, and that is how `chipSkin` and `windowControl` came to write colours the other side cannot
 * resolve.
 *
 * 🛑 **Its blind spot, written rather than hidden.** It reads the IMPORT, one hop. A window that
 * reaches `styles.ts` THROUGH a component of `design/` stays green, and must: a dock component
 * wears its own vocabulary wherever it is mounted. The journal is the witness — it renders
 * `ActivityList`, whose row imports the status tones, and that row belongs to the dock as much.
 */
const IMPORTS_STUDIO_STYLES = /from '@\/components\/styles'/

/** The families of window, read off the shell they frame themselves with rather than listed. */
const FAMILIES = [
  ...new Set(
    Object.entries(WINDOW_SOURCES)
      .filter(([, code]) => /<WindowShell[\s>]/.test(code))
      .map(([path]) => `./${path.split('/')[1] ?? ''}/`),
  ),
].filter(folder => folder !== './components/')

/**
 * Declared with the reason, which is the same one three times: `windowStyles.ts` publishes no
 * equivalent. It carries captions, rows and actions — no field role, no suffix, no gauge at all.
 */
const ALLOWED: readonly string[] = [
  './newDocument/NewDocumentWindow/NewDocumentWindow.tsx',
  './newDocument/NewDocumentWindow/NewDocumentTemplateTile.tsx',
  './settings/AiSettings/AiCandidateRow.tsx',
]

describe('a window that is not a dock', () => {
  /** Reading nothing would satisfy the rule below for ever, and this sweeps by glob. */
  it('finds the windows and their sources at all', () => {
    expect(FAMILIES.length).toBeGreaterThan(3)
    expect(Object.keys(WINDOW_SOURCES).length).toBeGreaterThan(400)
  })

  it('never reaches for the class strings of the docks', () => {
    const offenders = Object.entries(WINDOW_SOURCES)
      .filter(([path]) => FAMILIES.some(folder => path.startsWith(folder)))
      .filter(([path]) => !ALLOWED.includes(path))
      .filter(([, code]) => IMPORTS_STUDIO_STYLES.test(code))
      .map(([path]) => path)

    expect(offenders.sort()).toEqual([])
  })

  /**
   * A rule that cannot be shown to refuse anything refuses nothing — `windowStyles` is one word
   * away, and a pattern reading both would go quiet while staying green.
   */
  it('tells the studio module from the window one, which is what makes it a rule', () => {
    expect(IMPORTS_STUDIO_STYLES.test("import { rowSkin } from '@/components/styles'")).toBe(true)
    expect(
      IMPORTS_STUDIO_STYLES.test("import { WINDOW_ROW } from '@/components/windowStyles'"),
    ).toBe(false)
  })

  /** The exceptions are the rule's own state: one that stopped being needed and stayed is a hole. */
  it('declares no exception for a file that no longer needs one', () => {
    const stale = ALLOWED.filter(path => !IMPORTS_STUDIO_STYLES.test(WINDOW_SOURCES[path] ?? ''))

    expect(stale).toEqual([])
  })
})
