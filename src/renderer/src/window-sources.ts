/**
 * How a guard of the WINDOW reads its own modules as text.
 *
 * The main side has `main/source-files.ts`, which walks the disk. This one cannot: the renderer
 * has no filesystem, so its guards read through Vite's `import.meta.glob` instead. Three of them
 * spelt the same six patterns, and the third had drifted — see below.
 *
 * **A guard importing this reads nothing itself, so `wide-guards.ts` has to recognise the import
 * or the guard silently leaves the short loop.** `borrowsTheSweep` names both modules; that is
 * not optional housekeeping, it is the whole reason the extraction is safe. The repository has
 * already lost a guard that way once — the note above `borrowsTheSweep` tells the story.
 *
 * The patterns are relative to THIS file, which is why it sits at the root of `renderer/src`: a
 * `./**` written one folder down would sweep that folder alone, and every guard reading it would
 * go quiet while staying green.
 */
export const WINDOW_SOURCES: Record<string, string> = import.meta.glob(
  [
    './**/*.ts',
    './**/*.tsx',
    '!./**/*.test.ts',
    '!./**/*.test.tsx',
    // Both extensions, which is the drift this extraction closed: `no-uncached-formatter` excluded
    // `-fixtures.tsx` and swept `-fixtures.ts`, alone among the three. A fixture builds the data a
    // suite asserts on and reaches no screen — the line `main/source-files.ts` draws on its side.
    '!./**/*-fixtures.ts',
    '!./**/*-fixtures.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
)
