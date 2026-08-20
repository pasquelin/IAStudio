/**
 * The renderer's own sources, read as text — for the rules a test states about how the studio is
 * written rather than about what it renders.
 *
 * Read through Vite rather than `node:fs`: this project has no Node types, and a check like that
 * has to live beside the style it guards rather than in the main process for want of a reader.
 * The glob resolves against THIS file, so a consumer elsewhere in the tree would see a different
 * set — it is shared by the tests that sit beside it, not offered to the whole renderer.
 */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Path and source of every renderer module a rule applies to. Tests and benches are not one. */
export const WRITTEN_SOURCES = Object.entries(SOURCES).filter(
  ([path]) => !/\.(test|bench)\.tsx?$/.test(path),
)

/**
 * The other half: the suites themselves, for the few rules that are ABOUT how tests are written.
 * Kept rare on purpose — a rule over test text is a rule nobody reads before writing a test, so
 * it earns its place only where the cost of getting it wrong is a defect that stays silent.
 *
 * Shared rather than globbed per guard, and that is not only tidiness: `import.meta.glob` never
 * yields the module calling it, so a guard sweeping from its own file leaves ITSELF unread. The
 * sweep anchored here reads all 429 (2026-08-16), including the guards.
 */
export const SUITE_SOURCES = Object.entries(SOURCES).filter(([path]) => /\.test\.tsx?$/.test(path))

const hasAllWords = (words: readonly string[]) => (written: string) =>
  words.every(one => written.split(/\s+/).includes(one))

/**
 * What a caller writes back, at the CALL, of the constant it already wears — all the words or
 * none, and the call rather than the file, a component being free to wear `CONTROL` and to pad
 * something else. **Blind**: `cn(CONTROL, aVariable)`, or words reached by a second argument.
 */
export const rewrites = (constant: string, words: readonly string[]) => {
  // `\b` keeps `cn(WINDOW_ROW, …)` from reading a call to `WINDOW_ROW_BUTTON`.
  const call = new RegExp('cn\\(\\s*' + constant + '\\b\\s*,\\s*[\'"`]([^\'"`\\n]*)[\'"`]', 'g')

  return (source: string): boolean =>
    [...source.matchAll(call)].some(match => hasAllWords(words)(match[1] ?? ''))
}

/**
 * The same for a constant nobody wears yet: the whole set in ONE raw string, any order — the
 * formatter sorts stably, so an ordered pattern is walked past by retyping. **Blind**: the set
 * split across two strings; and it reads raw text, so a comment reciting the list reads as a copy.
 */
export const spellsOut = (words: readonly string[]) => (source: string) =>
  [...source.matchAll(/['"`]([^'"`\n]*)['"`]/g)].some(match => hasAllWords(words)(match[1] ?? ''))
