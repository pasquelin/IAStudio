import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CHECKER_TEXTURE,
  type InstalledCheckerTexture,
} from '@shared/domain/checkerTexture'
import { DEFAULT_MATERIAL } from './sceneState'
import {
  checkerTextureRef,
  defaultMeshMaterial,
  forgetCheckerTextures,
  rememberCheckerTextures,
} from './checkerTextures'

const INSTALLED: InstalledCheckerTexture[] = [
  { id: DEFAULT_CHECKER_TEXTURE, assetId: 'asset_default' },
  { id: 'gridSmall', assetId: 'asset_grid' },
]

afterEach(() => {
  forgetCheckerTextures()
})

describe('the working textures of a project', () => {
  it('dresses a new mesh once the project holds them', () => {
    rememberCheckerTextures(INSTALLED)
    expect(defaultMeshMaterial().map).toEqual({ assetId: 'asset_default' })
  })

  it('leaves a mesh in plain paint while the project holds none', () => {
    expect(defaultMeshMaterial()).toEqual(DEFAULT_MATERIAL)
  })

  // A project whose texture was deleted must not hand out a reference to nothing: the mesh comes
  // back plain rather than wearing a map that resolves to no file.
  it('falls back to plain paint for a texture this project never got', () => {
    rememberCheckerTextures([{ id: 'gridSmall', assetId: 'asset_grid' }])
    expect(defaultMeshMaterial('checkerLarge')).toEqual(DEFAULT_MATERIAL)
  })

  it('answers the reference of the one asked for', () => {
    rememberCheckerTextures(INSTALLED)
    expect(checkerTextureRef('gridSmall')).toEqual({ assetId: 'asset_grid' })
    expect(checkerTextureRef('checkerSmall')).toBeNull()
  })

  // Leaving a project must not leave its ids behind: the next one has assets of its own, and a
  // stale id would point a mesh at a texture of the project that was closed.
  it('drops what it knew when a project is replaced', () => {
    rememberCheckerTextures(INSTALLED)
    rememberCheckerTextures([{ id: 'checkerLarge', assetId: 'asset_other' }])

    expect(checkerTextureRef('gridSmall')).toBeNull()
    expect(checkerTextureRef('checkerLarge')).toEqual({ assetId: 'asset_other' })
  })
})
