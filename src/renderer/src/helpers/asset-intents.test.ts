import { describe, expect, it } from 'vitest'
import { ASSET_TYPES } from '@shared/domain/asset'
import { ASSET_INTENTS, intentAt, intentsFor } from './asset-intents'

describe('where an asset can be sent', () => {
  it('offers the montage for every kind, since that is where they all end up', () => {
    for (const type of ASSET_TYPES) {
      expect(intentsFor(type).map(intent => intent.id)).toContain('video.clip')
    }
  })

  it('offers a take only the places that take sound', () => {
    expect(intentsFor('audio').map(intent => intent.id)).toEqual(['audio.take', 'video.clip'])
  })

  it('offers a mesh the scene, and no picture slot', () => {
    const ids = intentsFor('mesh').map(intent => intent.id)

    expect(ids).toContain('3d.mesh')
    expect(ids).not.toContain('textures.channel')
    expect(ids).not.toContain('image.layer')
  })

  it('offers every picture kind the same destinations', () => {
    // A texture and a sky ARE pictures: the sky slot takes one, and so does a layer.
    const picture = intentsFor('image').map(intent => intent.id)

    expect(intentsFor('texture').map(intent => intent.id)).toEqual(picture)
    expect(intentsFor('skybox').map(intent => intent.id)).toEqual(picture)
    expect(picture).toContain('skyboxes.source')
    expect(picture).toContain('textures.channel')
  })

  it('finds a destination by name, and answers nothing for one that does not exist', () => {
    expect(intentAt('3d.mesh')?.workspace).toBe('3d')
    expect(intentAt('3d.hologram')).toBeNull()
  })

  it('gives every destination a distinct name', () => {
    const ids = ASSET_INTENTS.map(intent => intent.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('names a label and a glyph for each, since the menu draws both', () => {
    for (const intent of ASSET_INTENTS) {
      expect(intent.labelKey).toMatch(/^intents\./)
      expect(intent.icon.length).toBeGreaterThan(0)
    }
  })

  // The order IS the cascade a double-click follows; the montage has to close it, or it would
  // swallow every asset before a more specific destination was ever considered.
  it('leaves the catch-all last among the destinations that accept everything', () => {
    const catchAll = ASSET_INTENTS.findIndex(intent => intent.id === 'video.clip')
    const specific = ASSET_INTENTS.filter(intent => !intent.accepts('audio'))

    expect(specific.every(intent => ASSET_INTENTS.indexOf(intent) !== catchAll)).toBe(true)
    expect(ASSET_INTENTS.slice(0, catchAll).map(one => one.id)).toContain('audio.take')
  })
})
