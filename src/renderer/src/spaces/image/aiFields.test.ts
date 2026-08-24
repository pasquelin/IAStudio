import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { fillEditFields, fillSourceFields } from './aiFields'

const field = (overrides: Partial<FieldDescriptor>): FieldDescriptor => ({
  key: 'field',
  kind: 'text',
  label: 'Field',
  required: false,
  ...overrides,
})

const PROMPT = field({ key: 'prompt', kind: 'longText' })
const IMAGE = field({ key: 'image', kind: 'image' })
const MASK = field({ key: 'mask', kind: 'image', maskFrom: 'image' })

describe('filling a model form from an edit', () => {
  // By kind and by the pairing the model declares — never by name, or one model's field names
  // would be written into the studio.
  it('puts the picture in the field the mask says it masks', () => {
    const values = fillEditFields([PROMPT, IMAGE, MASK], { image: 'asset-1', mask: 'asset-2' })

    expect(values).toEqual({ image: 'asset-1', mask: 'asset-2' })
  })

  it('finds the picture field of a model that takes no mask', () => {
    const values = fillEditFields([PROMPT, field({ key: 'source', kind: 'image' })], {
      image: 'asset-1',
    })

    expect(values).toEqual({ source: 'asset-1' })
  })

  // A mask field is an image field too: filled as the picture, the model would edit its own mask.
  it('never mistakes the mask field for the picture one', () => {
    const values = fillEditFields([MASK, IMAGE], { image: 'asset-1' })

    expect(values).toEqual({ image: 'asset-1' })
  })

  it('leaves the mask out when the edit carries none', () => {
    const values = fillEditFields([IMAGE, MASK], { image: 'asset-1' })

    expect(values).toEqual({ image: 'asset-1' })
  })

  // A model that wants something else opens on its own defaults, not on a form half-blanked.
  it('writes nothing into a model that takes no picture at all', () => {
    expect(fillEditFields([PROMPT], { image: 'asset-1' })).toEqual({})
  })
})

describe('filling a form from what the workspace holds', () => {
  const FIELDS: FieldDescriptor[] = [
    { key: 'prompt', kind: 'longText', label: 'Prompt', required: true },
    { key: 'image', kind: 'image', label: 'Image', required: false },
    { key: 'mask', kind: 'image', label: 'Mask', required: false, maskFrom: 'image' },
    { key: 'mesh', kind: 'mesh', label: 'Mesh', required: false },
  ]

  it('puts a picture in the picture field, by kind and never by name', () => {
    expect(
      fillSourceFields(FIELDS, [{ role: 'source', kind: 'image', assetId: 'asset-1' }]),
    ).toEqual({ image: 'asset-1' })
  })

  it('puts a mesh in the field a model takes one under', () => {
    expect(
      fillSourceFields(FIELDS, [{ role: 'source', kind: 'mesh', assetId: 'asset-2' }]),
    ).toEqual({ mesh: 'asset-2' })
  })

  // The mask is what the model PAIRS with the picture, through `maskFrom` — never a second image.
  it('keeps a source out of the field reserved for a mask', () => {
    expect(
      fillSourceFields(FIELDS, [
        { role: 'source', kind: 'image', assetId: 'asset-1' },
        { role: 'mask', kind: 'image', assetId: 'asset-mask' },
      ]),
    ).toEqual({ image: 'asset-1', mask: 'asset-mask' })
  })

  // Two references go into two fields, never both into the first one.
  it('never fills one field twice', () => {
    const references: FieldDescriptor[] = [
      { key: 'first', kind: 'image', label: 'First', required: false },
      { key: 'second', kind: 'image', label: 'Second', required: false },
    ]

    expect(
      fillSourceFields(references, [
        { role: 'source', kind: 'image', assetId: 'asset-1' },
        { role: 'source', kind: 'image', assetId: 'asset-2' },
      ]),
    ).toEqual({ first: 'asset-1', second: 'asset-2' })
  })

  /**
   * 🛑 A model that takes nothing of this kind opens on its own defaults rather than on a form
   * half-blanked — and the panel keeps drawing the source, so nothing is spent in silence.
   */
  it('leaves alone what it cannot place', () => {
    expect(
      fillSourceFields(FIELDS, [{ role: 'source', kind: 'audio', assetId: 'asset-3' }]),
    ).toEqual({})
  })
})
