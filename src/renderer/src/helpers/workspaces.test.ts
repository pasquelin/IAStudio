import { describe, expect, it } from 'vitest'
import { ASSET_TYPES } from '@shared/domain/asset'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import {
  assetIcon,
  assetTypesOf,
  workspaceById,
  workspaceLabelKey,
  workspaceOfType,
  WORKSPACES,
} from './workspaces'

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

  /**
   * A space that declared no family would silently open the Models panel on the whole catalogue.
   * No space is entitled to that today, so every one of them has to carry a family.
   */
  it('maps every workspace to a model family', () => {
    for (const workspace of WORKSPACES) {
      expect(workspace.family).not.toBeNull()
    }
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

describe('what a space uses against what it produces', () => {
  // The two tables answer different questions, so they are not merged — but a space must at
  // least accept the kind it makes, and only reading both together says so.
  it('lets every space use the kind it produces', () => {
    for (const type of ASSET_TYPES) {
      expect(assetTypesOf(workspaceOfType(type))).toContain(type)
    }
  })
})
