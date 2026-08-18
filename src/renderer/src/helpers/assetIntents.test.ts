import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, type Asset } from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/assetKind'
import { kindForWorkspace } from '@shared/domain/document'
import { WORKSPACES } from './workspaces'
import { ASSET_INTENTS, editorIntent, intentsFor } from './assetIntents'

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

  // Two fields for one pairing, and `KIND_BY_WORKSPACE` is the one that decides. A destination
  // whose kind belonged to another workspace would write into a tab it never brings forward.
  it('names the workspace its own kind opens in', () => {
    for (const intent of ASSET_INTENTS) {
      expect(kindForWorkspace(intent.workspace)).toBe(intent.kind)
    }
  })

  // The order is the MENU's, and the montage takes every kind: a row that answers for everything
  // reads last, or it reads as the answer.
  it('lists the take and the sky before the montage', () => {
    const catchAll = ASSET_INTENTS.findIndex(intent => intent.id === 'video.clip')
    const before = ASSET_INTENTS.slice(0, catchAll).map(intent => intent.id)

    expect(before).toContain('audio.take')
    expect(before).toContain('skyboxes.source')
    expect(before).toContain('image.layer')
  })
})

describe('where an asset is edited', () => {
  // The guard on the deduction: an editor is read off `workspaceOfType`, so a kind whose own
  // space takes nothing of it would answer null — and a double-click on it would say nothing.
  it('names an editor for every kind there is', () => {
    for (const type of ASSET_TYPES) {
      const intent = editorIntent(picture({ type }))

      expect(intent).not.toBeNull()
      expect(intent?.workspace).toBe(workspaceOfType(type))
    }
  })

  it('edits a picture in Images, whatever else would take it', () => {
    expect(editorIntent(picture())?.id).toBe('image.layer')
  })

  // The two kinds a plain image shares its destinations with are edited in their own space,
  // which is the whole difference between editing an asset and placing one.
  it('edits a texture in Textures and a sky in Skyboxes', () => {
    expect(editorIntent(picture({ type: 'texture' }))?.id).toBe('textures.channel')
    expect(editorIntent(picture({ type: 'skybox' }))?.id).toBe('skyboxes.source')
  })

  it('edits a take in Audio and a mesh in 3D', () => {
    expect(editorIntent(picture({ type: 'audio' }))?.id).toBe('audio.take')
    expect(editorIntent(picture({ type: 'mesh' }))?.id).toBe('3d.mesh')
  })

  // Both live in 3D, and a motion is not a model: sending one to `3d.mesh` would land an
  // invisible node — the `SKELETON_ONLY` trap `rigState` was written for.
  it('tells a motion apart from a model, though both live in 3D', () => {
    expect(editorIntent(picture({ type: 'animation' }))?.id).toBe('3d.animation')
  })
})
