import { describe, expect, it } from 'vitest'
import { WRITTEN_SOURCES } from '../testHarness'

/**
 * One bar, drawn one way.
 *
 * The snap bar was written by hand as a `<div>` beside the tool column: a different radius, a
 * different padding and no shadow, so two pieces of furniture sat side by side saying they were
 * not the same kind of thing. `Toolbar` had carried `orientation="horizontal"` all along, and
 * `extras` is exactly where a control that is not a `ToolbarItem` goes.
 *
 * The written form is what this reads, because that is what went wrong — no prop was misused, a
 * component was simply not reached for.
 *
 * Any string LITERAL holding both, rather than an attribute: the first spelling of this rule
 * read `className="…"`, and the bar it was written for reached its classes through `cn(…)` —
 * so it went green over the very file it exists for. Measured before it was kept.
 */
const BAR_SURFACE = /(['"])[^'"\n]*\bbg-surface\b[^'"\n]*\bborder\b[^'"\n]*\1/

/**
 * Where a bordered surface is legitimately spelled: the bar itself, and the sheet that declares
 * the studio's shared styles — a field and a media frame are bordered too, and neither is
 * furniture recopied.
 */
const DECLARE_SURFACES: readonly string[] = ['./Toolbar/Toolbar.tsx', './styles.ts']

describe('the furniture of a toolbar', () => {
  it('finds the sources at all, so the rule below cannot pass on an empty list', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
  })

  /**
   * Two blind spots, written rather than hidden. It reads ONE shape — a bordered surface in a
   * string literal — so a bar rebuilt from a `styles.ts` constant walks past it. And it only
   * looks at files that already name `Toolbar`, so furniture written somewhere that never heard
   * of the component is invisible to it. A reminder where the mistake was made, not a proof.
   */
  it('is declared by the toolbar itself, never spelled again beside it', () => {
    const spelling = WRITTEN_SOURCES.filter(
      ([path, source]) =>
        !DECLARE_SURFACES.includes(path) &&
        BAR_SURFACE.test(source) &&
        /role="toolbar"|\bToolbar\b/.test(source),
    ).map(([path]) => path)

    expect(spelling).toEqual([])
  })
})
