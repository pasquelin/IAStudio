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
 */
export const SUITE_SOURCES = Object.entries(SOURCES).filter(([path]) => /\.test\.tsx?$/.test(path))
