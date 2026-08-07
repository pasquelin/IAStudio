import { describe, expect, it } from 'vitest'
import { ASSET_TYPES } from '@shared/domain/asset'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { assetIcon, workspaceById, workspaceLabelKey, WORKSPACES } from './workspaces'

describe('workspaces', () => {
  it('gives every workspace a translatable label key', () => {
    for (const workspace of WORKSPACES) {
      expect(workspaceLabelKey(workspace.id)).toBe(`workspaces.${workspace.id}`)
    }
  })

  it('finds a workspace by its id', () => {
    expect(workspaceById('3d').family).toBe('3d')
  })

  it('rejects an unknown id instead of returning an empty workspace', () => {
    expect(() => workspaceById('nope')).toThrow()
  })

  it('maps every workspace to a model family', () => {
    for (const workspace of WORKSPACES) expect(workspace.family).toBeTruthy()
  })

  it('has no two workspaces sharing an id', () => {
    const ids = WORKSPACES.map(workspace => workspace.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a default workspace that exists', () => {
    expect(WORKSPACES.some(workspace => workspace.id === DEFAULT_WORKSPACE)).toBe(true)
  })
})

describe('what stands for an asset with no picture', () => {
  it('gives every kind of asset an icon of its own', () => {
    const icons = ASSET_TYPES.map(assetIcon)
    expect(icons.every(Boolean)).toBe(true)
    // A sound and a mesh must not share a glyph, or the browser says nothing by showing one.
    expect(new Set(icons).size).toBe(ASSET_TYPES.length)
  })

  it('reads them off the workspace table, so a rail icon and a tile cannot drift apart', () => {
    expect(assetIcon('video')).toBe(workspaceById('video').icon)
    expect(assetIcon('mesh')).toBe(workspaceById('3d').icon)
    expect(assetIcon('skybox')).toBe(workspaceById('skyboxes').icon)
  })
})
