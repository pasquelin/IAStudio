import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import {
  buildBody,
  defaultValues,
  groupFields,
  referencePictures,
  visibleFields,
} from './dynamicForm'
import { field } from './dynamic-form-fixtures'

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

describe('referencePictures', () => {
  const picture = (key: string): FieldDescriptor => ({
    key,
    kind: 'image',
    label: key,
    required: false,
  })

  it('collects the picture fields the user filled, in declaration order', () => {
    const fields = [
      picture('reference'),
      field({ key: 'prompt', kind: 'longText' }),
      picture('mask'),
    ]

    expect(
      referencePictures(fields, { reference: 'asset_one', prompt: 'a boulder', mask: 'asset_two' }),
    ).toEqual(['asset_one', 'asset_two'])
  })

  it('skips the ones left empty', () => {
    const fields = [picture('reference'), picture('mask')]

    expect(referencePictures(fields, { reference: 'asset_one', mask: '   ' })).toEqual([
      'asset_one',
    ])
  })

  it('answers nothing when the model takes no picture', () => {
    const fields = [field({ key: 'prompt', kind: 'longText' })]

    expect(referencePictures(fields, { prompt: 'a boulder' })).toEqual([])
  })
})
