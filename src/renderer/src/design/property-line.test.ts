import { describe, expect, it } from 'vitest'
import { FIELD_LABEL, FIELD_ROW } from './styles'

/**
 * The two families of property line — `PropertyRow` for a value to read, the fields for a
 * control to change it — have to start at the same place.
 *
 * Five inspectors out of six draw both inside one group, and they used to declare their label
 * column twice: `w-20` on one side, `w-16` on the other, with eight pixels of inset on one and
 * none on the other. Three things diverged where the user sees one list.
 */
/** Read as text, since what is under test is the classes the component writes, not its output. */
const SOURCES: Record<string, string> = import.meta.glob('./PropertyRow.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const propertyRow = Object.values(SOURCES)[0] ?? ''

describe('the label column of a property line', () => {
  it('finds the row at all, so the rules below cannot pass on an empty file', () => {
    expect(propertyRow).toContain('export function PropertyRow')
  })

  it('is one gauge, read by both families rather than written twice', () => {
    expect(FIELD_LABEL).toContain('w-(--sc-label)')
    expect(propertyRow).toContain('w-(--sc-label)')
  })

  /** The lookbehind keeps `min-w-0` out of it: a minimum of zero is not a column width. */
  it('is never a hardcoded width on either side', () => {
    const HARDCODED_WIDTH = /(?<![\w-])w-\d/

    expect(FIELD_LABEL).not.toMatch(HARDCODED_WIDTH)
    expect(propertyRow).not.toMatch(HARDCODED_WIDTH)
  })

  /**
   * The inset belongs to the group, which is what makes the two families line up: a row that
   * carried its own started where no field could follow it.
   */
  it('leaves the horizontal inset to whatever holds the row', () => {
    expect(propertyRow).not.toMatch(/\bpx-\d/)
    expect(FIELD_ROW).not.toMatch(/\bpx-\d/)
  })

  /** Same height too, or two lines of the same list are not the same height. */
  it('gives both families the height of a control', () => {
    expect(FIELD_ROW).toContain('min-h-(--sc-control)')
    expect(propertyRow).toContain('min-h-(--sc-control)')
  })
})
