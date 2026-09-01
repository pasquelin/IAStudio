import { describe, expect, it } from 'vitest'
import { UPLOAD_KIND_BY_TYPE, uploadMimeTypeOf } from './assetMime'

describe('the kind the API files an upload under', () => {
  it('sends a sky up as the picture it is', () => {
    // The API has no notion of one; what makes it a sky is how the studio reads it back.
    expect(UPLOAD_KIND_BY_TYPE.skybox).toBe('image')
  })

  it('calls a mesh what the API calls it', () => {
    expect(UPLOAD_KIND_BY_TYPE.mesh).toBe('3d')
  })
})

describe('the content type of a file on its way up', () => {
  it('reads the extension, whatever its case', () => {
    expect(uploadMimeTypeOf('boulder.PNG')).toBe('image/png')
    expect(uploadMimeTypeOf('take.MP4')).toBe('video/mp4')
  })

  it('knows every family the API accepts', () => {
    expect(uploadMimeTypeOf('a.jpg')).toBe('image/jpeg')
    expect(uploadMimeTypeOf('a.wav')).toBe('audio/wav')
    expect(uploadMimeTypeOf('a.webm')).toBe('video/webm')
    expect(uploadMimeTypeOf('a.glb')).toBe('model/gltf-binary')
    expect(uploadMimeTypeOf('a.fbx')).toBe('application/vnd.autodesk.fbx')
  })

  it('reads only the last extension', () => {
    expect(uploadMimeTypeOf('take.final.mp4')).toBe('video/mp4')
  })

  it('refuses what the API does not take, rather than guessing', () => {
    // Guessing costs the whole transfer: the server validates once the file has arrived.
    expect(uploadMimeTypeOf('layers.psd')).toBeNull()
    expect(uploadMimeTypeOf('README')).toBeNull()
  })
})
