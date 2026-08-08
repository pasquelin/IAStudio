import { describe, expect, it } from 'vitest'
import { assetTypeOf, linkedAsset, mediaFilters } from './link'

describe('media kind from a file name', () => {
  it('reads a rush as video, whatever the case of its extension', () => {
    expect(assetTypeOf('/Volumes/Rushes/A001_C003.MOV')).toBe('video')
  })

  it('reads a recording as audio and a still as image', () => {
    expect(assetTypeOf('/takes/voice.wav')).toBe('audio')
    expect(assetTypeOf('/plates/sky.jpg')).toBe('image')
  })

  // Without this, only generated models could be imported — which makes no sense for a studio
  // whose whole point is mixing what it makes with what you already have.
  it('reads a model as mesh, whatever the case of its extension', () => {
    expect(assetTypeOf('/props/chair.glb')).toBe('mesh')
    expect(assetTypeOf('/props/chair.GLB')).toBe('mesh')
  })

  it('reads nothing from a file the studio has no editor for', () => {
    expect(assetTypeOf('/notes.txt')).toBeNull()
    expect(assetTypeOf('/no-extension')).toBeNull()
    // Announced nowhere rather than accepted and then failing in the viewport: a `.gltf` cannot
    // resolve its sidecars once served flat, and nothing here reads `.obj` or `.fbx` at all.
    expect(assetTypeOf('/props/chair.gltf')).toBeNull()
    expect(assetTypeOf('/props/chair.obj')).toBeNull()
    expect(assetTypeOf('/props/chair.fbx')).toBeNull()
  })
})

describe('linked asset', () => {
  const asset = linkedAsset('/Volumes/Rushes/A001_C003.MOV', {
    id: 'asset-1',
    type: 'video',
    now: '2026-08-07T10:00:00.000Z',
  })

  it('is named after the file, without its extension', () => {
    expect(asset.name).toBe('A001_C003')
  })

  it('records where the file is, and nothing inside the project', () => {
    // Linked, never copied: a twenty-minute 4K rush is twenty gigabytes.
    expect(asset.sourcePath).toBe('/Volumes/Rushes/A001_C003.MOV')
    expect(asset.path).toBeUndefined()
  })

  it('is local, since the file sits on this machine', () => {
    expect(asset.location).toBe('local')
  })
})

describe('import dialog filters', () => {
  const labels = {
    all: 'Tous les médias',
    video: 'Vidéo',
    audio: 'Audio',
    image: 'Image',
    mesh: 'Modèle 3D',
  }

  it('offers every media kind first, then one filter per kind, in the user language', () => {
    expect(mediaFilters(labels).map(filter => filter.name)).toEqual([
      'Tous les médias',
      'Vidéo',
      'Audio',
      'Image',
      'Modèle 3D',
    ])
  })

  it('lists extensions without a leading dot, which the dialog rejects', () => {
    expect(mediaFilters(labels)[1]?.extensions).not.toContain('.mp4')
    expect(mediaFilters(labels)[1]?.extensions).toContain('mp4')
  })

  it('offers every kind in the first filter, so one pick can mix rushes and takes', () => {
    expect(mediaFilters(labels)[0]?.extensions).toEqual(
      expect.arrayContaining(['mov', 'wav', 'png']),
    )
  })
})
