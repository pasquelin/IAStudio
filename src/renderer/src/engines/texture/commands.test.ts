import { describe, expect, it } from 'vitest'
import { run, undo, emptyHistory } from '../core/history'
import { applyStyle, setChannel, setMaterial, setPreview } from './commands'
import { newTexture, type ChannelMap, type TextureState } from './texture-state'

const MAP: ChannelMap = { assetId: 'a1', origin: 'imported', width: 512, height: 512 }

function applied(
  texture: TextureState,
  ...commands: ReturnType<typeof setMaterial>[]
): TextureState {
  let state = texture
  let history = emptyHistory<TextureState>()
  for (const command of commands) [state, history] = run(state, history, command)
  return state
}

describe('setMaterial', () => {
  // Redo replays a command: a revert that never ran has no earlier value to write back, and
  // writing `undefined` would empty the section.
  it('gives the texture back untouched when it is reverted before it ran', () => {
    const texture = newTexture()

    expect(setMaterial('roughness', 0.25).revert(texture)).toBe(texture)
  })

  it('writes one setting and leaves the others alone', () => {
    const next = applied(newTexture(), setMaterial('roughness', 0.25))

    expect(next.material.roughness).toBe(0.25)
    expect(next.material.metalness).toBe(newTexture().material.metalness)
  })

  // Every frame of one drag carries the same id and collapses into a single undo entry; two
  // different settings must not, or undoing the second would give back the first as well.
  it('gives each setting an id of its own', () => {
    expect(setMaterial('roughness', 0).id).not.toBe(setMaterial('metalness', 0).id)
    expect(setMaterial('roughness', 0).id).toBe(setMaterial('roughness', 1).id)
  })

  it('gives back what it replaced', () => {
    const before = newTexture()
    const [after, history] = run(before, emptyHistory<TextureState>(), setMaterial('metalness', 1))
    const [reverted] = undo(after, history)

    expect(reverted.material).toEqual(before.material)
  })
})

describe('setPreview', () => {
  it('writes one setting of the preview', () => {
    const next = applied(newTexture(), setPreview('shape', 'plane'))

    expect(next.preview.shape).toBe('plane')
    expect(next.preview.environment).toEqual(newTexture().preview.environment)
  })

  it('never shares an id with a material setting', () => {
    expect(setPreview('autoSpin', true).id).not.toBe(setMaterial('rotation', 1).id)
  })
})

describe('setChannel', () => {
  it('puts a map in a channel', () => {
    const next = applied(newTexture(), setChannel('baseColor', MAP))
    expect(next.channels.baseColor).toEqual(MAP)
  })

  it('takes one out', () => {
    const next = applied(newTexture(), setChannel('baseColor', MAP), setChannel('baseColor', null))
    expect(next.channels.baseColor).toBeUndefined()
  })

  it('leaves the other channels where they are', () => {
    const next = applied(
      newTexture(),
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
    const before = applied(newTexture(), setChannel('baseColor', MAP))
    const [after, history] = run(
      before,
      emptyHistory<TextureState>(),
      setChannel('baseColor', null),
    )
    const [reverted] = undo(after, history)

    expect(reverted.channels.baseColor).toEqual(MAP)
  })
})

describe('applyStyle', () => {
  const STYLE = { ...newTexture().material, roughness: 0.1, metalness: 1, heightScale: 0.2 }

  it('writes every value of the style at once', () => {
    const next = applied(newTexture(), applyStyle('style_1', STYLE))

    expect(next.material).toEqual(STYLE)
  })

  it('leaves the channels alone — a style says how to read maps, never which', () => {
    const withMap: TextureState = { ...newTexture(), channels: { baseColor: MAP } }

    const next = applied(withMap, applyStyle('style_1', STYLE))

    expect(next.channels).toEqual({ baseColor: MAP })
  })

  it('takes one undo entry back to what was there before', () => {
    const [applied, history] = run(
      newTexture(),
      emptyHistory<TextureState>(),
      applyStyle('s', STYLE),
    )
    const [reverted] = undo(applied, history)

    expect(reverted.material).toEqual(newTexture().material)
  })

  /**
   * Applying two styles in a row must leave two entries. Sharing one id would coalesce them, and
   * undoing the second would silently give back what was there before the first.
   */
  it('gives each style an id of its own', () => {
    expect(applyStyle('style_1', STYLE).id).not.toBe(applyStyle('style_2', STYLE).id)
  })
})
