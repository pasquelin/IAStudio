import { describe, expect, it } from 'vitest'

/**
 * Every component, as text — read through Vite rather than through `fs`, as the wide guards next
 * door do: the renderer has no filesystem, and a test living here does not get one.
 */
const COMPONENTS: Record<string, string> = import.meta.glob(
  ['../**/*.tsx', '!../**/*.test.tsx', '!../**/*-fixtures.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * The retry `useLoadable` offers is worth nothing without the `key` that spends it: re-rendering
 * the same `src` asks the browser for nothing, so a caller that reads `src` and drops `attempt`
 * gets the old behaviour back — one failure, an icon for as long as the tile lives.
 *
 * Nothing else would say so. It type-checks, it renders, and the tile that would have recovered
 * simply does not. Three callers had to be taught this by hand; the fourth is what this holds.
 */
describe('what a caller of useLoadable owes the picture it draws', () => {
  /** Every `<img …>` opening tag of a file that reads this hook, one entry per tag. */
  const pictures = Object.entries(COMPONENTS)
    .filter(([, code]) => code.includes('useLoadable('))
    .flatMap(([path, code]) =>
      code
        .split('<img')
        .slice(1)
        .map(tag => ({ path, tag })),
    )

  it('is read by more than nothing, so an empty list is never a pass', () => {
    expect(pictures.length).toBeGreaterThan(0)
  })

  /**
   * Read per TAG and not per file: a second picture added beside the first would inherit the
   * `key` of its neighbour as far as a whole-file search is concerned, and never retry.
   *
   * The blind spot left, stated rather than hidden: a caller that renames what it destructures
   * (`attempt: n`) reads as a miss, and one that spells its picture some other way than `<img`
   * — a background, a `<picture>` — is not looked at at all.
   */
  it('puts the attempt on every picture it draws, as its key', () => {
    const without = pictures
      .filter(
        ({ tag }) =>
          tag.includes('onError') && !tag.slice(0, tag.indexOf('>')).includes('key={attempt}'),
      )
      .map(({ path }) => path)

    expect(without).toEqual([])
  })
})
