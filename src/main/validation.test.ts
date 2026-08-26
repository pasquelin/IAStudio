import { describe, expect, it } from 'vitest'
import { FILE_NAME_MAX_LENGTH, safeFileName } from '@shared/domain/fileName'
import { pathSegment } from './validation'

/** A clapperboard: one code point, and two UTF-16 units — which is the whole subject here. */
const astral = (count: number) => String.fromCodePoint(0x1f3ac).repeat(count)

/** Built rather than typed: a literal control character makes the file binary to `git grep`. */
const nextLine = String.fromCodePoint(0x85)

describe('a path segment', () => {
  // `safeFileName` cuts by code point, so a title of emoji came back at twice its length in
  // UTF-16 units and was refused by the boundary that had just been handed it.
  it('keeps every name the cleaner is willing to produce', () => {
    expect(
      pathSegment.safeParse(safeFileName(astral(FILE_NAME_MAX_LENGTH * 2), 'file')).success,
    ).toBe(true)
  })

  // Both rows, so the bound is pinned at one number rather than at an interval.
  it('refuses a name past its own bound and keeps the last one under it', () => {
    expect(pathSegment.safeParse('x'.repeat(120)).success).toBe(true)
    expect(pathSegment.safeParse('x'.repeat(121)).success).toBe(false)
  })

  // A separator writes elsewhere, a dot at either end is what the cleaner refuses to produce,
  // and a control character throws only once the folder around it has been written.
  it('refuses every shape that is not one name inside one folder', () => {
    expect(pathSegment.safeParse('exports/set').success).toBe(false)
    expect(pathSegment.safeParse('exports\\set').success).toBe(false)
    expect(pathSegment.safeParse('.').success).toBe(false)
    expect(pathSegment.safeParse('..').success).toBe(false)
    expect(pathSegment.safeParse('..set').success).toBe(false)
    expect(pathSegment.safeParse('set..').success).toBe(false)
    expect(pathSegment.safeParse(`set${nextLine}dressing`).success).toBe(false)
  })
})
