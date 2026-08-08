import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import formSource from './dynamic-form.ts?raw'
import { buildSchema } from './dynamic-form-schema'

function field(overrides: Partial<FieldDescriptor> & { key: string }): FieldDescriptor {
  return { kind: 'text', label: overrides.key, required: false, ...overrides }
}

describe('the schema half of the dynamic form', () => {
  it('keeps zod out of the module the panels read', () => {
    expect(formSource).not.toMatch(/from 'zod'/)
    // The other half: `dynamic-form` must still be the one holding what the panels need, or the
    // line above would pass by having moved everything here — zod included.
    expect(formSource).toMatch(/export function referencePictures/)
  })

  it('refuses an empty required field and accepts a filled one', () => {
    const schema = buildSchema([field({ key: 'prompt', required: true })])

    expect(schema.safeParse({ prompt: '' }).success).toBe(false)
    expect(schema.safeParse({ prompt: 'a cat' }).success).toBe(true)
  })

  it('holds an integer field to its bounds', () => {
    const schema = buildSchema([field({ key: 'steps', kind: 'integer', min: 1, max: 50 })])

    expect(schema.safeParse({ steps: 0 }).success).toBe(false)
    expect(schema.safeParse({ steps: 51 }).success).toBe(false)
    expect(schema.safeParse({ steps: 25 }).success).toBe(true)
  })
})
