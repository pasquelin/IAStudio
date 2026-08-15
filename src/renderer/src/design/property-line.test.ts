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

/** The third family, read the same way — see the last case of this file for why it is here. */
const ROW: Record<string, string> = import.meta.glob('./Row.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const rowSource = Object.values(ROW)[0] ?? ''

/**
 * Every field of the family, read the same way. The rule below was once fixed on ONE of them —
 * `ToggleField`, where a label had been seen truncated mid-word — and the eight others went on
 * truncating in silence. A rule repaired on one exemplar is a rule nothing holds.
 */
const FIELDS: Record<string, string> = import.meta.glob('./*Field.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const named = (source: string): boolean => source.includes('title={label}')

/** Either gauge: both truncate, so both owe the reader the whole label somewhere. */
const labelled = (source: string): boolean => source.includes('FIELD_LABEL')

describe('the label column of a property line', () => {
  it('finds the row at all, so the rules below cannot pass on an empty file', () => {
    expect(propertyRow).toContain('export function PropertyRow')
  })

  /**
   * Read from the constant now, not spelt out a second time: the row wears `FIELD_LABEL` itself,
   * which is what "one gauge" was always after — the two spellings had converged to the byte,
   * and two identical strings are still two things to keep in step.
   */
  it('is one gauge, read by both families rather than written twice', () => {
    expect(FIELD_LABEL).toContain('w-(--sc-label)')
    expect(propertyRow).toContain('FIELD_LABEL')
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
    expect(propertyRow).toContain('FIELD_ROW')
  })
})

describe('a label the column is too narrow for', () => {
  it('finds the fields at all, so the rule below cannot pass on an empty glob', () => {
    expect(Object.keys(FIELDS).length).toBeGreaterThan(5)
  })

  /**
   * The column truncates, so the whole label has to be reachable somewhere. `PropertyRow` learned
   * this first and the fields did not follow: « Sortie du … » read as an instruction of its own
   * on a canvas whose every node already carries a port called « Sortie ».
   */
  it('is reachable on hover from every field that draws one', () => {
    const silent = Object.entries(FIELDS)
      .filter(([, source]) => labelled(source) && !named(source))
      .map(([path]) => path)

    expect(silent, `these draw a truncating label with no title: ${silent.join(', ')}`).toEqual([])
  })

  /**
   * Both gauges are counted, and that is not a detail: the rule above once read `FIELD_LABEL`
   * alone, so the day `ToggleField` moved to the wide one it left the guard through the back
   * door — silently, and it is the very file the rule was first repaired on.
   */
  it('counts the fields that wear the wide label as well as the fixed column', () => {
    const wide = Object.entries(FIELDS)
      .filter(([, source]) => source.includes('FIELD_LABEL_WIDE'))
      .map(([path]) => path)

    // One, and named: a field with a control to place has a column to line up on, and taking the
    // wide label there would put its name where the neighbours draw their sliders.
    expect(wide).toEqual(['./ToggleField.tsx'])
  })

  it('is reachable on the row family too, which is where the rule started', () => {
    expect(named(propertyRow)).toBe(true)
  })

  /**
   * And on `Row`, which is the third family: a field that hands its whole line over to it — a
   * texture slot does — leaves this glob, since it no longer names `FIELD_LABEL` anywhere. The
   * rule has to be held where the truncation now happens, or it is held nowhere at all.
   *
   * Both lines: the name is tipped by `Row` itself, the kind under it was not, and « Occlusion
   * ambian… » is exactly the case the rule was written for.
   */
  it('is reachable on both lines of `Row`, which fields now delegate to', () => {
    expect(rowSource).toContain('title={subtitle}')
    expect(rowSource).toContain('tip(title')
  })
})
