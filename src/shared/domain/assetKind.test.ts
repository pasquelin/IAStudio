import { describe, expect, it } from 'vitest'
import { channelFromProviderType } from './material'
import { assetTypeOfRemote } from './assetKind'

describe('assetTypeOfRemote', () => {
  it('files every PBR channel as a picture, whatever its kind says', () => {
    const channels = [
      'texture-albedo',
      'texture-normal',
      'texture-height',
      'texture-metallic',
      'texture-ao',
      'texture-edge',
      'texture-smoothness',
      '3d-texture-albedo',
      '3d-texture-normal',
      '3d-texture-metallic',
      '3d-texture-roughness',
    ]

    for (const metadataType of channels) {
      expect(assetTypeOfRemote({ kind: 'image', metadataType })).toBe('image')
    }
  })

  it('files a channel of a textured mesh as a picture rather than as the mesh', () => {
    expect(assetTypeOfRemote({ kind: '3d', metadataType: '3d-texture-normal' })).toBe('image')
  })

  it('files an LDR skybox as a skybox, though the API calls it an image', () => {
    // The regression this ordering exists for: `skybox-base-360` is `kind: 'image'`, and
    // trusting the kind alone filed every 360 as an ordinary picture.
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'skybox-base-360' })).toBe('skybox')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'skybox-3d' })).toBe('skybox')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'upscale-skybox' })).toBe('skybox')
  })

  it('files an HDR image as a skybox on its kind alone', () => {
    expect(assetTypeOfRemote({ kind: 'image-hdr', metadataType: 'skybox-hdri' })).toBe('skybox')
    expect(assetTypeOfRemote({ kind: 'image-hdr' })).toBe('skybox')
  })

  it('files a picture of a material as the picture it is', () => {
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'texture' })).toBe('image')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'upscale-texture' })).toBe('image')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'inference-txt2img-texture' })).toBe(
      'image',
    )
  })

  it('trusts an explicit non-image kind over the provenance', () => {
    expect(assetTypeOfRemote({ kind: '3d', metadataType: 'img23d' })).toBe('mesh')
    expect(assetTypeOfRemote({ kind: 'video', metadataType: 'img2video' })).toBe('video')
    expect(assetTypeOfRemote({ kind: 'audio', metadataType: 'txt2audio' })).toBe('audio')
  })

  it('files an ordinary generation as an image', () => {
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'txt2img' })).toBe('image')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'uploaded' })).toBe('image')
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'background-removal' })).toBe('image')
  })

  // Without this a mesh found by search came back as nothing: `kind` is absent from every hit,
  // and `img23d` alone said nothing to the reader.
  it('reads what a provenance produced off the end of its name', () => {
    expect(assetTypeOfRemote({ metadataType: 'img23d' })).toBe('mesh')
    expect(assetTypeOfRemote({ metadataType: 'uploaded-3d' })).toBe('mesh')
    expect(assetTypeOfRemote({ metadataType: 'img2splat' })).toBe('mesh')
    expect(assetTypeOfRemote({ metadataType: 'txt2video' })).toBe('video')
    expect(assetTypeOfRemote({ metadataType: 'upscale-video' })).toBe('video')
    expect(assetTypeOfRemote({ metadataType: 'txt2audio' })).toBe('audio')
    expect(assetTypeOfRemote({ metadataType: 'voice-clone' })).toBe('audio')
  })

  it('follows what a conversion produced, not what it consumed', () => {
    expect(assetTypeOfRemote({ metadataType: 'video2audio' })).toBe('audio')
    expect(assetTypeOfRemote({ metadataType: 'audio2video' })).toBe('video')
    // Ends in both `23d` and `video`; what it yields is the mesh.
    expect(assetTypeOfRemote({ metadataType: 'video23d' })).toBe('mesh')
  })

  it('falls back to the mime type when the kind is missing, as it is on a search hit', () => {
    expect(assetTypeOfRemote({ metadataType: 'txt2img', mimeType: 'image/png' })).toBe('image')
    expect(assetTypeOfRemote({ mimeType: 'video/mp4' })).toBe('video')
    expect(assetTypeOfRemote({ mimeType: 'audio/wav' })).toBe('audio')
    expect(assetTypeOfRemote({ mimeType: 'model/gltf-binary' })).toBe('mesh')
    expect(assetTypeOfRemote({ mimeType: 'application/vnd.autodesk.fbx' })).toBe('mesh')
  })

  it('keeps the provenance ahead of the mime type on a search hit', () => {
    expect(assetTypeOfRemote({ metadataType: 'skybox-base-360', mimeType: 'image/png' })).toBe(
      'skybox',
    )
  })

  it('turns away what is data about an asset rather than an asset', () => {
    expect(assetTypeOfRemote({ kind: 'json', metadataType: 'img2txt' })).toBeNull()
    expect(assetTypeOfRemote({ kind: 'text', metadataType: 'txt2txt' })).toBeNull()
    expect(assetTypeOfRemote({ kind: 'document' })).toBeNull()
    expect(assetTypeOfRemote({})).toBeNull()
  })

  it('turns away a stated non-media kind even when the mime type looks like a medium', () => {
    // A captioning result carries the mime type of the picture it describes. Falling back to
    // it would file the caption as that picture.
    expect(
      assetTypeOfRemote({ kind: 'json', metadataType: 'img2txt', mimeType: 'image/png' }),
    ).toBeNull()
  })

  it('lets a type this build has never heard of land on its kind', () => {
    // The API adds types without warning; an unknown one must not make the asset vanish.
    expect(assetTypeOfRemote({ kind: 'image', metadataType: 'txt2hologram' })).toBe('image')
  })
})

/**
 * The kind is gone, so `map` is the only thing left saying a picture belongs to a material —
 * `editorIntent` reads it and nothing else. A whole-surface generation carries no NAMED channel,
 * which is exactly the commonest one the Materials space makes.
 */
describe('the channel a generated picture carries', () => {
  it('reads a whole surface as the base colour it fills', () => {
    for (const metadataType of ['texture', 'upscale-texture', 'inference-txt2img-texture']) {
      expect(channelFromProviderType(metadataType)).toEqual({ channel: 'baseColor' })
    }
  })

  it('leaves a named channel alone', () => {
    expect(channelFromProviderType('texture-normal')).toEqual({ channel: 'normal' })
    expect(channelFromProviderType('texture-smoothness')).toEqual({
      channel: 'roughness',
      inverted: true,
    })
  })

  it('claims nothing for a picture no material asked for', () => {
    expect(channelFromProviderType('txt2img')).toBeNull()
    expect(channelFromProviderType('skybox-base-360')).toBeNull()
  })
})
