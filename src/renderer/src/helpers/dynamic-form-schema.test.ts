import { describe, expect, it } from 'vitest'
import formSource from './dynamic-form.ts?raw'
import { field } from './dynamic-form-fixtures'
import { buildSchema } from './dynamic-form-schema'

describe('schema building', () => {
  it('keeps zod out of the module the panels read', () => {
    expect(formSource).not.toMatch(/from 'zod'/)
    // The other half: `dynamic-form` must still hold what the panels need, or the line above
    // would pass by having moved everything here — zod included.
    expect(formSource).toMatch(/export function referencePictures/)
  })

  it('requires what the model declares required', () => {
    const schema = buildSchema([field({ key: 'prompt', required: true })])

    expect(schema.safeParse({ prompt: 'a rock' }).success).toBe(true)
    expect(schema.safeParse({ prompt: '' }).success).toBe(false)
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('lets an optional field stay empty', () => {
    const schema = buildSchema([field({ key: 'negative' })])
    expect(schema.safeParse({ negative: '' }).success).toBe(true)
  })

  it('enforces the bounds the model published', () => {
    const schema = buildSchema([field({ key: 'steps', kind: 'integer', min: 1, max: 50 })])

    expect(schema.safeParse({ steps: 28 }).success).toBe(true)
    expect(schema.safeParse({ steps: 51 }).success).toBe(false)
    expect(schema.safeParse({ steps: 0 }).success).toBe(false)
  })

  it('refuses a fraction where the model asked for an integer', () => {
    const schema = buildSchema([field({ key: 'steps', kind: 'integer' })])

    expect(schema.safeParse({ steps: 2.5 }).success).toBe(false)
    expect(
      buildSchema([field({ key: 'guidance', kind: 'number' })]).safeParse({ guidance: 2.5 }),
    ).toMatchObject({ success: true })
  })

  // An unknown kind is a plain string field: it must never make the form disappear.
  it('accepts an unknown kind as free input', () => {
    const schema = buildSchema([field({ key: 'mystery', kind: 'raw' })])
    expect(schema.safeParse({ mystery: 'anything' }).success).toBe(true)
  })
})
