import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { fillEditFields } from './aiFields'

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
