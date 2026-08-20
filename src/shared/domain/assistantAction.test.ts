import { describe, expect, it } from 'vitest'
import { type ActionField, validatesInput } from './assistantAction'

const field = (partial: Partial<ActionField> & Pick<ActionField, 'key' | 'kind'>): ActionField => ({
  labelKey: 'assistant.fields.query',
  required: false,
  ...partial,
})

describe('an input, checked against the fields that declare it', () => {
  it('wants every required field, and lets an optional one be absent', () => {
    const fields = [
      field({ key: 'path', kind: 'text', required: true }),
      field({ key: 'deep', kind: 'boolean' }),
    ]

    expect(validatesInput(fields, { path: 'assets' })).toBe(true)
    expect(validatesInput(fields, { path: 'assets', deep: true })).toBe(true)
    expect(validatesInput(fields, {})).toBe(false)
  })

  /**
   * The schema promises `additionalProperties: false`, and this is what keeps that a fact rather
   * than a courtesy: a client whose misspelt key was ignored in silence would believe the value
   * took, and act on a document that never changed.
   */
  it('refuses a key nothing declares rather than ignoring it', () => {
    expect(validatesInput([field({ key: 'path', kind: 'text' })], { pah: 'assets' })).toBe(false)
  })

  it('holds each kind to what it accepts', () => {
    expect(validatesInput([field({ key: 'n', kind: 'number' })], { n: 1.5 })).toBe(true)
    expect(validatesInput([field({ key: 'n', kind: 'number' })], { n: '1.5' })).toBe(false)
    expect(validatesInput([field({ key: 'n', kind: 'integer' })], { n: 1.5 })).toBe(false)
    expect(validatesInput([field({ key: 'b', kind: 'boolean' })], { b: 'yes' })).toBe(false)
    // Not a number at all, and the one a bare `typeof` lets through.
    expect(validatesInput([field({ key: 'n', kind: 'number' })], { n: Number.NaN })).toBe(false)
  })

  /**
   * Every reader of a colour falls back SILENTLY on one it cannot parse — `readColor` on the
   * value already there, `packedColour` on nothing — so an unchecked colour was answered `ok`
   * with the paint never applied.
   */
  it('holds a colour to a hex the studio can actually read', () => {
    const fields = [field({ key: 'color', kind: 'color' })]

    expect(validatesInput(fields, { color: '#1a2b3c' })).toBe(true)
    expect(validatesInput(fields, { color: 'reddish' })).toBe(false)
    expect(validatesInput(fields, { color: '#1a2' })).toBe(false)
  })

  it('holds a closed field to the values it closes over', () => {
    const fields = [field({ key: 'axis', kind: 'choice', options: ['x', 'y'] })]

    expect(validatesInput(fields, { axis: 'x' })).toBe(true)
    expect(validatesInput(fields, { axis: 'z' })).toBe(false)
  })

  it('holds a bounded number to its bounds', () => {
    const fields = [field({ key: 'opacity', kind: 'number', min: 0, max: 1 })]

    expect(validatesInput(fields, { opacity: 0.5 })).toBe(true)
    expect(validatesInput(fields, { opacity: 2 })).toBe(false)
  })

  /**
   * A required field may not be present-but-empty, and that lives here rather than in the
   * handlers: it was one `=== ''` and one `length === 0` per action before, ninety times over,
   * and an action that forgot either had nothing behind it.
   */
  it('refuses a required text that is blank, and a required list that is empty', () => {
    expect(
      validatesInput([field({ key: 'name', kind: 'text', required: true })], { name: ' ' }),
    ).toBe(false)
    expect(validatesInput([field({ key: 'name', kind: 'text' })], { name: '' })).toBe(true)

    const many = [field({ key: 'paths', kind: 'text', required: true, repeated: true })]
    expect(validatesInput(many, { paths: [] })).toBe(false)
    expect(validatesInput(many, { paths: ['a'] })).toBe(true)
  })

  it('takes a list only where the field says it repeats, and checks each item', () => {
    const one = [field({ key: 'paths', kind: 'text' })]
    const many = [field({ key: 'paths', kind: 'text', repeated: true })]

    expect(validatesInput(one, { paths: ['a'] })).toBe(false)
    expect(validatesInput(many, { paths: ['a', 'b'] })).toBe(true)
    expect(validatesInput(many, { paths: ['a', 2] })).toBe(false)
    expect(validatesInput(many, { paths: 'a' })).toBe(false)
  })

  /**
   * `raw` carries a generation model's own parameters, whose shape is only known once
   * `GET /models/{id}` has answered. Anything defined is therefore in bounds — and `null` is
   * defined, which is what a client sends to clear a value.
   */
  it('takes anything defined for a raw field', () => {
    const fields = [field({ key: 'parameters', kind: 'raw', required: true })]

    expect(validatesInput(fields, { parameters: { seed: 1 } })).toBe(true)
    expect(validatesInput(fields, { parameters: 'a string' })).toBe(true)
    expect(validatesInput(fields, { parameters: null })).toBe(true)
    expect(validatesInput(fields, { parameters: undefined })).toBe(false)
  })
})
