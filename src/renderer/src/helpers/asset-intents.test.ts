import { beforeEach, describe, expect, it } from 'vitest'
import { ASSET_TYPES, type Asset } from '@shared/domain/asset'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { WORKSPACES } from './workspaces'
import { ASSET_INTENTS, defaultIntent, intentsFor } from './asset-intents'

const picture = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset_1',
  name: 'moss.png',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

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

  it('gives every destination a distinct name', () => {
    const ids = ASSET_INTENTS.map(intent => intent.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // The menu draws the label and reads the glyph off the workspace table, so a destination
  // naming a space that does not exist would render without one.
  it('names a label and a real workspace for each', () => {
    const spaces = WORKSPACES.map(workspace => workspace.id)

    for (const intent of ASSET_INTENTS) {
      expect(intent.labelKey).toMatch(/^intents\./)
      expect(spaces).toContain(intent.workspace)
    }
  })

  // The order IS the cascade a double-click follows; the montage takes every kind, so anything
  // more specific has to be considered before it is.
  it('weighs the take and the sky before the montage', () => {
    const catchAll = ASSET_INTENTS.findIndex(intent => intent.id === 'video.clip')
    const before = ASSET_INTENTS.slice(0, catchAll).map(intent => intent.id)

    expect(before).toContain('audio.take')
    expect(before).toContain('skyboxes.source')
    expect(before).toContain('image.layer')
  })
})

describe('what a double-click settles on', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('finds nowhere to send an asset when no document is in front', () => {
    expect(defaultIntent(picture())).toBeNull()
  })

  it('lays a picture on the image tab that is in front', () => {
    installDocument('img-1', 'image')

    expect(defaultIntent(picture())?.id).toBe('image.layer')
  })

  // `placeAsset` refuses an asset with no file behind it. A `ready` that only counted open tabs
  // would settle here anyway, and the double-click would do nothing at all.
  it('refuses the layer for a picture the cloud still holds', () => {
    installDocument('img-1', 'image')

    expect(defaultIntent(picture({ location: 'cloud' }))).toBeNull()
  })

  // The montage used to answer yes whatever was open, which put it in front of the texture
  // channel for every asset — a destination the table listed and no gesture could reach.
  it('reaches the texture channel, which the montage used to hide', () => {
    installDocument('tex-1', 'textures')

    expect(defaultIntent(picture())?.id).toBe('textures.channel')
  })

  it('sends anything to the montage when a sequence is in front', () => {
    installDocument('seq-1', 'video')

    expect(defaultIntent(picture())?.id).toBe('video.clip')
    expect(defaultIntent(picture({ type: 'mesh' }))?.id).toBe('video.clip')
  })
})
