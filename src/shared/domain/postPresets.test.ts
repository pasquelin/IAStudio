import { describe, expect, it } from 'vitest'
import { POST_EFFECTS, type PostStack } from './postProcessing'
import { numericBoundsOf } from './propertySpec'
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

  /**
   * A value outside its own slider is not refused — `boundParam` brings it back at the moment the
   * stack is built. So the recipe would read as one look and apply as another, and every gate
   * would stay green: the drift lives in the source and nowhere else.
   */
  it('holds every value inside the bounds its own spec declares', () => {
    const outside = POST_PRESET_IDS.flatMap(id =>
      POST_PRESETS[id].flatMap(step =>
        Object.entries(step.params ?? {}).flatMap(([name, value]) => {
          const spec = POST_EFFECTS[step.effect].params[name]
          if (!spec || typeof value !== 'number') return []

          // A spec with no bounds — a toggle, a choice — has nothing to be outside of.
          const bounds = numericBoundsOf(spec)
          if (bounds?.min === undefined || bounds.max === undefined) return []

          const inside = value >= bounds.min && value <= bounds.max
          return inside ? [] : [`${id}: ${step.effect}.${name} = ${value}`]
        }),
      ),
    )

    expect(outside).toEqual([])
  })

  /**
   * An effect of the `render` slot draws the scene ITSELF, so it stands at the head of a chain and
   * two of them cannot both. `planStack` drops the second without a word — a recipe pairing GTAO
   * with SSAO would ship one occlusion pass that nobody asked for and hide the other.
   */
  it('asks for at most one pass that draws the scene', () => {
    const doubled = POST_PRESET_IDS.filter(
      id => POST_PRESETS[id].filter(step => POST_EFFECTS[step.effect].slot === 'render').length > 1,
    )

    expect(doubled).toEqual([])
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
