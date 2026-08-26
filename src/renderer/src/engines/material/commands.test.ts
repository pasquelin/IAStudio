import { describe, expect, it } from 'vitest'
import { run, undo, emptyHistory } from '../core/history'
import { applyStyle, setChannel, setMaterialSetting, setPreview } from './commands'
import { newMaterial, type ChannelMap, type MaterialState } from './materialState'

const MAP: ChannelMap = { assetId: 'a1', origin: 'imported', width: 512, height: 512 }

function applied(
  texture: MaterialState,
  ...commands: ReturnType<typeof setMaterialSetting>[]
): MaterialState {
  let state = texture
  let history = emptyHistory<MaterialState>()
  for (const command of commands) [state, history] = run(state, history, command)
  return state
}

describe('setMaterialSetting', () => {
  // Redo replays a command: a revert that never ran has no earlier value to write back, and
  // writing `undefined` would empty the section.
  it('gives the texture back untouched when it is reverted before it ran', () => {
    const texture = newMaterial()

    expect(setMaterialSetting('roughness', 0.25).revert(texture)).toBe(texture)
  })

  it('writes one setting and leaves the others alone', () => {
    const next = applied(newMaterial(), setMaterialSetting('roughness', 0.25))

    expect(next.material.roughness).toBe(0.25)
    expect(next.material.metalness).toBe(newMaterial().material.metalness)
  })

  // Every frame of one drag carries the same id and collapses into a single undo entry; two
  // different settings must not, or undoing the second would give back the first as well.
  it('gives each setting an id of its own', () => {
    expect(setMaterialSetting('roughness', 0).id).not.toBe(setMaterialSetting('metalness', 0).id)
    expect(setMaterialSetting('roughness', 0).id).toBe(setMaterialSetting('roughness', 1).id)
  })

  it('gives back what it replaced', () => {
    const before = newMaterial()
    const [after, history] = run(
      before,
      emptyHistory<MaterialState>(),
      setMaterialSetting('metalness', 1),
    )
    const [reverted] = undo(after, history)

    expect(reverted.material).toEqual(before.material)
  })
})

describe('setPreview', () => {
  it('writes one setting of the preview', () => {
    const next = applied(newMaterial(), setPreview('shape', 'plane'))

    expect(next.preview.shape).toBe('plane')
    expect(next.preview.environment).toEqual(newMaterial().preview.environment)
  })

  it('never shares an id with a material setting', () => {
    expect(setPreview('autoSpin', true).id).not.toBe(setMaterialSetting('rotation', 1).id)
  })
})

describe('setChannel', () => {
  it('puts a map in a channel', () => {
    const next = applied(newMaterial(), setChannel('baseColor', MAP))
    expect(next.channels.baseColor).toEqual(MAP)
  })

  it('takes one out', () => {
    const next = applied(newMaterial(), setChannel('baseColor', MAP), setChannel('baseColor', null))
    expect(next.channels.baseColor).toBeUndefined()
  })

  it('leaves the other channels where they are', () => {
    const next = applied(
      newMaterial(),
      setChannel('baseColor', MAP),
      setChannel('normal', { ...MAP, assetId: 'a2' }),
      setChannel('baseColor', null),
    )

    expect(next.channels.normal?.assetId).toBe('a2')
  })

  // Two channels dragged one after the other are two things the user did.
  it('gives each channel an id of its own', () => {
    expect(setChannel('baseColor', MAP).id).not.toBe(setChannel('normal', MAP).id)
  })

  it('gives back the channel it replaced', () => {
    const before = applied(newMaterial(), setChannel('baseColor', MAP))
    const [after, history] = run(
      before,
      emptyHistory<MaterialState>(),
      setChannel('baseColor', null),
    )
    const [reverted] = undo(after, history)

    expect(reverted.channels.baseColor).toEqual(MAP)
  })
})

describe('applyStyle', () => {
  const STYLE = { ...newMaterial().material, roughness: 0.1, metalness: 1, heightScale: 0.2 }

  it('writes every value of the style at once', () => {
    const next = applied(newMaterial(), applyStyle('style_1', STYLE))

    expect(next.material).toEqual(STYLE)
  })

  it('leaves the channels alone — a style says how to read maps, never which', () => {
    const withMap: MaterialState = { ...newMaterial(), channels: { baseColor: MAP } }

    const next = applied(withMap, applyStyle('style_1', STYLE))

    expect(next.channels).toEqual({ baseColor: MAP })
  })

  it('takes one undo entry back to what was there before', () => {
    const [applied, history] = run(
      newMaterial(),
      emptyHistory<MaterialState>(),
      applyStyle('s', STYLE),
    )
    const [reverted] = undo(applied, history)

    expect(reverted.material).toEqual(newMaterial().material)
  })

  /**
   * Applying two styles in a row must leave two entries. Sharing one id would coalesce them, and
   * undoing the second would silently give back what was there before the first.
   */
  it('gives each style an id of its own', () => {
    expect(applyStyle('style_1', STYLE).id).not.toBe(applyStyle('style_2', STYLE).id)
  })
})
