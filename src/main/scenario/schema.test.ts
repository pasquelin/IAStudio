import { describe, expect, it } from 'vitest'
import { SKYBOX_TAG } from '@shared/domain/model'
import { familyOf, translateSchema, type ScenarioInput } from './schema'

describe('translateSchema', () => {
  it('turns a bounded integer into an integer field', () => {
    const [field] = translateSchema([
      { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, step: 1, default: 28 },
    ])
    expect(field).toMatchObject({
      key: 'numInferenceSteps',
      kind: 'integer',
      min: 1,
      max: 50,
      step: 1,
      default: 28,
    })
  })

  it('turns a fractional step into a real number', () => {
    const [field] = translateSchema([
      { name: 'guidance', type: 'number', step: 0.5, min: 1, max: 10 },
    ])
    expect(field?.kind).toBe('number')
  })

  it('turns a string with allowed values into a dropdown', () => {
    const [field] = translateSchema([
      { name: 'aspectRatio', type: 'string', allowedValues: ['1:1', '16:9'] },
    ])
    expect(field?.kind).toBe('choice')
    expect(field?.options).toEqual([
      { value: '1:1', label: '1:1' },
      { value: '16:9', label: '16:9' },
    ])
  })

  it('tells prompt, color and plain text apart', () => {
    const fields = translateSchema([
      { name: 'prompt', type: 'string', prompt: true },
      { name: 'background', type: 'string', color: true },
      { name: 'title', type: 'string' },
    ])
    expect(fields.map(field => field.kind)).toEqual(['longText', 'color', 'text'])
  })

  it('recognizes the seed by its name', () => {
    const [field] = translateSchema([{ name: 'seed', type: 'number' }])
    expect(field?.kind).toBe('seed')
  })

  it('treats an image file as an image and the rest as raw', () => {
    const fields = translateSchema([
      { name: 'image', type: 'file', kind: 'image' },
      { name: 'doc', type: 'file', kind: 'document' },
    ])
    expect(fields.map(field => field.kind)).toEqual(['image', 'raw'])
  })

  it('falls back to raw input on an unknown type instead of dropping the field', () => {
    const fields = translateSchema([{ name: 'whatever', type: 'unknown-type' }])
    expect(fields).toHaveLength(1)
    expect(fields[0]?.kind).toBe('raw')
  })

  it('makes an API name readable when no label is provided', () => {
    const [field] = translateSchema([{ name: 'numInferenceSteps', type: 'number' }])
    expect(field?.label).toBe('Num inference steps')
  })

  it('prefers the label provided by the model', () => {
    const [field] = translateSchema([{ name: 'numInferenceSteps', type: 'number', label: 'Steps' }])
    expect(field?.label).toBe('Steps')
  })

  it('marks a field required only when the rule is "always"', () => {
    const fields = translateSchema([
      { name: 'a', type: 'string', required: { always: true } },
      { name: 'b', type: 'string', required: {} },
      { name: 'c', type: 'string' },
    ])
    expect(fields.map(field => field.required)).toEqual([true, false, false])
  })

  it('accepts a complete absence of inputs', () => {
    expect(translateSchema(undefined)).toEqual([])
  })

  it('does not invent a missing default value', () => {
    const [field] = translateSchema([{ name: 'a', type: 'string' }])
    expect(field).not.toHaveProperty('default')
  })

  it('keeps every input, unknown ones included', () => {
    const inputs: ScenarioInput[] = [
      { name: 'a', type: 'string' },
      { name: 'b', type: 'inputs_array' },
      { name: 'c', type: 'model' },
    ]
    expect(translateSchema(inputs)).toHaveLength(3)
  })
})

describe('familyOf', () => {
  it('classifies an image-to-video model as video, not image', () => {
    expect(familyOf(['img2video', 'txt2video'])).toBe('video')
  })

  it('recognizes 3D, audio and image', () => {
    expect(familyOf(['img23d'])).toBe('3d')
    expect(familyOf(['txt2audio'])).toBe('audio')
    expect(familyOf(['txt2img', 'inpaint'])).toBe('image')
  })

  it('falls back to "other" with no usable capability', () => {
    expect(familyOf([])).toBe('other')
    expect(familyOf(undefined)).toBe('other')
    expect(familyOf(['txt2txt'])).toBe('other')
  })

  // The three public skybox models answer `txt2img`/`img2img` like any image model, so the
  // capabilities alone put them in the wrong workspace. Only the tag tells them apart.
  it('classifies a tagged panorama model as skybox, not image', () => {
    expect(familyOf(['txt2img', 'img2img'], [SKYBOX_TAG])).toBe('skybox')
    expect(familyOf(['img2img'], ['panorama', '360', SKYBOX_TAG])).toBe('skybox')
  })

  it('leaves an untagged image model where it was', () => {
    expect(familyOf(['txt2img'], ['panorama'])).toBe('image')
    expect(familyOf(['txt2img'], [])).toBe('image')
  })

  // `skybox-upscale`, which carries no `sc:skybox`: an upscaler belongs with the pictures it
  // enlarges, not in a workspace whose documents it cannot produce.
  it('does not claim a skybox upscaler', () => {
    expect(familyOf(['img2img'], ['sc:scenario', 'skybox-upscale'])).toBe('image')
  })
})
