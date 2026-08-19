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

/** The one component that now draws a name in the shared column, read the same way. */
const LABEL: Record<string, string> = import.meta.glob('./PropertyLabel.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const labelSource = Object.values(LABEL)[0] ?? ''

/**
 * Read with the comments stripped, which is not a detail: four rules of this file were matching
 * their own prose. `expect(propertyRow).toContain('FIELD_LABEL')` was green on the sentence « It
 * wears `FIELD_ROW` and `FIELD_LABEL` » long after the row had stopped wearing it — so deleting a
 * stale comment failed the suite while deleting the class did not.
 */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const named = (source: string): boolean => code(source).includes('title={label}')

describe('the label column of a property line', () => {
  it('finds the row at all, so the rules below cannot pass on an empty file', () => {
    expect(propertyRow).toContain('export function PropertyRow')
  })

  /**
   * One gauge, and one place that reads it: both families now go through `PropertyLabel`, so
   * "shared" is no longer two spellings kept in step but a single component both call.
   */
  it('is one gauge, read through one component rather than written twice', () => {
    expect(FIELD_LABEL).toContain('w-(--sc-label)')
    expect(code(propertyRow)).toContain('<PropertyLabel')
    expect(code(labelSource)).toContain('FIELD_LABEL')
  })

  /** The lookbehind keeps `min-w-0` out of it: a minimum of zero is not a column width. */
  it('is never a hardcoded width on either side', () => {
    const HARDCODED_WIDTH = /(?<![\w-])w-\d/

    expect(FIELD_LABEL).not.toMatch(HARDCODED_WIDTH)
    expect(code(propertyRow)).not.toMatch(HARDCODED_WIDTH)
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
   *
   * ONE place says it now, and that is what the two-column reading bought: the column carries a
   * fill and an edge, so it has to stand its row's full height — and a box that stretches cannot
   * also be the box that truncates. `PropertyLabel` holds both halves, and the rule with them.
   */
  it('is reachable on hover from the one component that draws a name', () => {
    expect(labelSource).toContain('export function PropertyLabel')
    expect(named(labelSource)).toBe(true)
    // The CLASS, not the word: `truncate` appears twice in this file's own prose, so a rule
    // reading the raw source stayed green with the class deleted.
    expect(code(labelSource)).toContain('className="min-w-0 truncate"')
  })

  /**
   * The rule above is only worth anything while nothing goes round it. A field that reached for
   * the gauge itself would draw a name in the column with no `title` and no rule down its side —
   * which is exactly how eight of them used to spell out the same three lines.
   */
  it('is drawn by no field on its own', () => {
    const spelling = Object.entries(FIELDS)
      .filter(([, source]) => code(source).includes('FIELD_LABEL'))
      .map(([path]) => path)

    expect(spelling, `these draw the column themselves: ${spelling.join(', ')}`).toEqual([])
  })

  /**
   * Every line ENDS on one column too, and that is the other half of the two-column reading:
   * `FieldActions` holds the room a reset or a padlock takes whether or not one is drawn there.
   *
   * Measured on 2026-08-19 before it existed: a reset appears the moment a value leaves its
   * default, so the field narrowed from 86px to 74px UNDER the pointer, mid-drag — and the six
   * families of line ended on five different columns.
   *
   * Read on `FIELD_ROW`, since that class IS what makes a line one. The blind spot is a field
   * that ends its row inside a helper of its own: nothing here would follow it there.
   */
  it('holds the end column on every family that draws a property line', () => {
    const missing = Object.entries({ ...FIELDS, './PropertyRow.tsx': propertyRow })
      .filter(([, source]) => code(source).includes('FIELD_ROW'))
      .filter(([, source]) => !code(source).includes('<FieldActions'))
      .map(([path]) => path)

    expect(missing, `these end where they please: ${missing.join(', ')}`).toEqual([])
  })

  /** The wide gauge is gone with it: a checkbox now starts where every other control starts. */
  it('offers one gauge only, no field reaching for a second', () => {
    expect(code(labelSource)).not.toContain('FIELD_LABEL_WIDE')

    const asking = Object.entries(FIELDS)
      .filter(([, source]) =>
        [...code(source).matchAll(/<PropertyLabel\b[\s\S]*?\/>/g)].some(m => /\bwide\b/.test(m[0])),
      )
      .map(([path]) => path)

    expect(asking).toEqual([])
  })

  /**
   * The STACKED shape, and only it — the two column shapes go through `PropertyLabel` and are
   * held above. Stacked draws its own span, so it owes its own `title`: the value sits under the
   * name there, which is a second line to run out of room on rather than a column to truncate in.
   */
  it('is reachable on the row family too, where the column does not bind', () => {
    expect(named(propertyRow)).toBe(true)
    expect(code(propertyRow)).toContain("shape === 'stacked' ?")
  })

  /**
   * And on `Row`, which is the third family — the LISTS now, no longer the fields: `LinkField`
   * took its name back into the shared label column, so a texture slot is held by the rule above
   * again. What is left here is the outliner, the layer stack and the model's own maps, where two
   * lines of text still truncate inside one row.
   */
  it('is reachable on both lines of `Row`, which every list of the studio draws', () => {
    expect(code(rowSource)).toContain('title={subtitle}')
    expect(code(rowSource)).toContain('tip(title')
  })
})
