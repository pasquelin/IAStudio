import { describe, expect, it } from 'vitest'
import { POST_EFFECTS, type PostStack } from './postProcessing'
import {
  POST_PRESETS,
  POST_PRESET_IDS,
  POST_PRESET_VERSION,
  postPresetFile,
  readPostPresetFile,
  stackFromPreset,
} from './postPresets'

let minted = 0
const mintId = (): string => `made-${(minted += 1)}`

describe('the compositions the studio ships', () => {
  /**
   * The whole point of a preset: it has to produce a coherent LOOK, and a recipe naming a
   * parameter no effect declares would silently do nothing on that line.
   */
  it('names only parameters the effects it uses actually declare', () => {
    const wrong = POST_PRESET_IDS.flatMap(id =>
      POST_PRESETS[id].flatMap(step =>
        Object.keys(step.params ?? {}).flatMap(name =>
          POST_EFFECTS[step.effect].params[name] ? [] : [`${id}: ${step.effect}.${name}`],
        ),
      ),
    )

    expect(wrong).toEqual([])
  })

  it('builds a stack of fresh instances rather than a reference', () => {
    const first = stackFromPreset('cinematic', mintId)
    const second = stackFromPreset('cinematic', mintId)

    expect(first.effects.map(one => one.effect)).toEqual(second.effects.map(one => one.effect))
    expect(first.effects[0]?.id).not.toBe(second.effects[0]?.id)
  })

  it('leaves the parameters a recipe says nothing about on their own defaults', () => {
    const bloom = stackFromPreset('cinematic', mintId).effects.find(one => one.effect === 'bloom')

    expect(bloom?.params.strength).toBe(0.5)
    expect(bloom?.params.threshold).toBe(0.9)
  })

  it('opens the empty one on nothing at all', () => {
    expect(stackFromPreset('none', mintId).effects).toEqual([])
  })
})

describe('a composition exchanged as a file', () => {
  const written = (stack: PostStack): unknown =>
    JSON.parse(JSON.stringify(postPresetFile('My Look', stack)))

  it('comes back with the same effects, in the same order', () => {
    const held = stackFromPreset('cyberpunk', mintId)
    const read = readPostPresetFile(written(held), mintId)

    expect(read.ok && read.name).toBe('My Look')
    expect(read.ok && read.stack.effects.map(one => one.effect)).toEqual(
      held.effects.map(one => one.effect),
    )
  })

  it('refuses anything that is not one', () => {
    expect(readPostPresetFile({ type: 'a-scene' }, mintId)).toEqual({ ok: false, reason: 'shape' })
    expect(readPostPresetFile(null, mintId)).toEqual({ ok: false, reason: 'shape' })
  })

  /** A version from the future is refused; one from the past is read by the current reader. */
  it('refuses a file written by a newer studio', () => {
    const ahead = { ...postPresetFile('x', stackFromPreset('none', mintId)) }

    expect(readPostPresetFile({ ...ahead, version: POST_PRESET_VERSION + 1 }, mintId)).toEqual({
      ok: false,
      reason: 'version',
    })
    expect(readPostPresetFile({ ...ahead, version: 0 }, mintId).ok).toBe(true)
  })

  it('applies what it can and names what it dropped', () => {
    const read = readPostPresetFile(
      {
        type: 'post-processing-preset',
        version: 1,
        name: 'Half known',
        stack: { enabled: true, effects: [{ effect: 'bloom' }, { effect: 'raytracing' }] },
      },
      mintId,
    )

    expect(read.ok && read.stack.effects.map(one => one.effect)).toEqual(['bloom'])
    expect(read.ok && read.dropped).toEqual(['raytracing'])
  })

  /**
   * § 12, held by the shape rather than by a check: a file names ids and numbers, and an effect
   * is a member of a union that lives in the code. There is nowhere for a shader to ride.
   */
  it('carries nothing a reader could run', () => {
    const read = readPostPresetFile(
      {
        type: 'post-processing-preset',
        version: 1,
        name: 'Nasty',
        stack: {
          enabled: true,
          effects: [{ effect: 'bloom', params: { strength: 1, shader: 'void main(){}' } }],
        },
      },
      mintId,
    )

    expect(read.ok && Object.keys(read.stack.effects[0]?.params ?? {})).toEqual([
      'strength',
      'radius',
      'threshold',
    ])
  })
})
