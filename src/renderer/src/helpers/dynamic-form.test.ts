import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { buildBody, buildSchema, defaultValues, groupFields, visibleFields } from './dynamic-form'

function field(overrides: Partial<FieldDescriptor> & { key: string }): FieldDescriptor {
  return { kind: 'text', label: overrides.key, required: false, ...overrides }
}

describe('schema building', () => {
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

describe('default values', () => {
  it('uses what the model published, and a blank otherwise', () => {
    expect(
      defaultValues([
        field({ key: 'steps', kind: 'integer', default: 28 }),
        field({ key: 'prompt' }),
        field({ key: 'hires', kind: 'boolean' }),
      ]),
    ).toEqual({ steps: 28, prompt: '', hires: false })
  })
})

describe('dependencies', () => {
  const fields = [
    field({ key: 'mode', kind: 'choice' }),
    field({ key: 'strength', dependsOn: { key: 'mode', value: 'img2img' } }),
  ]

  it('hides a field whose dependency is unmet', () => {
    expect(visibleFields(fields, { mode: 'txt2img' }).map(item => item.key)).toEqual(['mode'])
  })

  it('shows it once the dependency is satisfied', () => {
    expect(visibleFields(fields, { mode: 'img2img' }).map(item => item.key)).toEqual([
      'mode',
      'strength',
    ])
  })
})

describe('body building', () => {
  it('drops what was left empty rather than sending a blank', () => {
    const body = buildBody([field({ key: 'prompt' }), field({ key: 'negative' })], {
      prompt: 'a rock',
      negative: '',
    })

    expect(body).toEqual({ prompt: 'a rock' })
  })

  it('drops a hidden field even when it still holds a value', () => {
    const fields = [
      field({ key: 'mode', kind: 'choice' }),
      field({ key: 'strength', kind: 'number', dependsOn: { key: 'mode', value: 'img2img' } }),
    ]

    expect(buildBody(fields, { mode: 'txt2img', strength: 0.7 })).toEqual({ mode: 'txt2img' })
  })

  it('keeps a false boolean, which is a value and not an absence', () => {
    expect(buildBody([field({ key: 'hires', kind: 'boolean' })], { hires: false })).toEqual({
      hires: false,
    })
  })

  it('keeps a zero, which is a value and not an absence', () => {
    expect(buildBody([field({ key: 'seed', kind: 'seed' })], { seed: 0 })).toEqual({ seed: 0 })
  })
})

describe('grouping', () => {
  it('keeps the order the model published, ungrouped fields first', () => {
    const grouped = groupFields([
      field({ key: 'prompt' }),
      field({ key: 'steps', group: 'Advanced' }),
      field({ key: 'seed', group: 'Advanced' }),
    ])

    expect(grouped.map(([name, items]) => [name, items.map(item => item.key)])).toEqual([
      ['', ['prompt']],
      ['Advanced', ['steps', 'seed']],
    ])
  })
})
